package encode

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"

	"github.com/davidbyttow/govips/v2/vips"
)

const maxEdge = 480

func Thumbnail(ctx context.Context, file, ext string, animate bool) ([]byte, error) {
	if ext == "mp4" || ext == "webm" || ext == "mov" {
		return video(ctx, file)
	}
	if animate && (ext == "gif" || ext == "webp") {
		if encoded, err := animated(file); err == nil {
			return encoded, nil
		}
	}
	return still(file)
}

func still(file string) ([]byte, error) {
	params := vips.NewImportParams()
	pages := vips.IntParameter{}
	pages.Set(1)
	params.NumPages = pages
	image, err := vips.LoadThumbnailFromFile(file, maxEdge, maxEdge, vips.InterestingNone, vips.SizeDown, params)
	if err != nil {
		return nil, err
	}
	defer image.Close()
	return export(image)
}

func animated(file string) ([]byte, error) {
	params := vips.NewImportParams()
	pages := vips.IntParameter{}
	pages.Set(-1)
	params.NumPages = pages
	image, err := vips.LoadImageFromFile(file, params)
	if err != nil {
		return nil, err
	}
	defer image.Close()
	if image.Pages() < 2 {
		return export(image)
	}
	if err := image.ThumbnailWithSize(maxEdge, maxEdge, vips.InterestingNone, vips.SizeDown); err != nil {
		return nil, err
	}
	return export(image)
}

func video(ctx context.Context, file string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-hide_banner", "-loglevel", "error",
		"-ss", "0",
		"-i", file,
		"-frames:v", "1",
		"-vf", "scale=480:480:force_original_aspect_ratio=decrease",
		"-f", "image2pipe",
		"-vcodec", "mjpeg",
		"pipe:1",
	)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("ffmpeg: %w: %s", err, stderr.String())
	}
	if stdout.Len() == 0 {
		return nil, fmt.Errorf("ffmpeg produced no frame")
	}
	image, err := vips.NewImageFromBuffer(stdout.Bytes())
	if err != nil {
		return nil, err
	}
	defer image.Close()
	return export(image)
}

func export(image *vips.ImageRef) ([]byte, error) {
	if err := image.AutoRotate(); err != nil {
		return nil, err
	}
	params := vips.NewWebpExportParams()
	params.Quality = 80
	params.StripMetadata = true
	encoded, _, err := image.ExportWebp(params)
	return encoded, err
}
