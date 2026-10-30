package store

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/url"
	"os"
	"path"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

const maxBytes = 20 * 1024 * 1024

type Store struct {
	client *minio.Client
	bucket string
}

func New(endpoint, bucket, accessKey, secretKey string) (*Store, error) {
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return nil, err
	}
	host := parsed.Host
	if host == "" {
		return nil, fmt.Errorf("S3 endpoint %q needs a host", endpoint)
	}
	client, err := minio.New(host, &minio.Options{
		Creds:        credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure:       parsed.Scheme == "https",
		BucketLookup: minio.BucketLookupPath,
	})
	if err != nil {
		return nil, err
	}
	return &Store{client: client, bucket: bucket}, nil
}

func (s *Store) Size(ctx context.Context, key string) (int64, bool, error) {
	info, err := s.client.StatObject(ctx, s.bucket, key, minio.StatObjectOptions{})
	if err != nil {
		if minio.ToErrorResponse(err).StatusCode == 404 {
			return 0, false, nil
		}
		return 0, false, err
	}
	return info.Size, true, nil
}

func (s *Store) Download(ctx context.Context, key string) (string, func(), error) {
	object, err := s.client.GetObject(ctx, s.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return "", nil, err
	}
	defer object.Close()
	info, err := object.Stat()
	if err != nil {
		if minio.ToErrorResponse(err).StatusCode == 404 {
			return "", nil, fmt.Errorf("original is not in storage")
		}
		return "", nil, err
	}
	if info.Size <= 0 || info.Size > maxBytes {
		return "", nil, fmt.Errorf("original is empty or over 20 MB")
	}
	file, err := os.CreateTemp("", "kura-thumb-*"+path.Ext(key))
	if err != nil {
		return "", nil, err
	}
	cleanup := func() { _ = os.Remove(file.Name()) }
	written, err := io.Copy(file, io.LimitReader(object, maxBytes+1))
	closeErr := file.Close()
	if err != nil || closeErr != nil || written != info.Size {
		cleanup()
		if err != nil {
			return "", nil, err
		}
		return "", nil, fmt.Errorf("original download was incomplete")
	}
	return file.Name(), cleanup, nil
}

func (s *Store) Upload(ctx context.Context, key string, body []byte) error {
	_, err := s.client.PutObject(ctx, s.bucket, key, bytes.NewReader(body), int64(len(body)), minio.PutObjectOptions{
		ContentType: "image/webp",
	})
	return err
}
