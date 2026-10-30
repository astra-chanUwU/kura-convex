package key

import (
	"fmt"
	"path"
	"regexp"
)

// Pictures Convex already named. User uploads are images/<uuid>.<ext>.
// Seed files are images/<board>/<id>.<ext> for safebooru, danbooru, gelbooru,
// konachan, and yandere. Video extensions are accepted by the encoder; the
// board still uploads still images only.
var objectKey = regexp.MustCompile(`^images/(?:[0-9a-f-]{36}|(?:safebooru|danbooru|gelbooru|konachan|yandere)/[0-9]+)\.(jpg|png|webp|gif|mp4|webm|mov)$`)

func Parse(storageKey string) (thumbKey, ext string, err error) {
	match := objectKey.FindStringSubmatch(storageKey)
	if match == nil || storageKey != path.Clean(storageKey) {
		return "", "", fmt.Errorf("unsupported storage key")
	}
	ext = match[1]
	return storageKey[:len(storageKey)-len(ext)] + "thumb.webp", ext, nil
}

func Image(ext string) bool {
	switch ext {
	case "jpg", "png", "webp", "gif":
		return true
	default:
		return false
	}
}
