package key

import "testing"

func TestParse(t *testing.T) {
	thumb, ext, err := Parse("images/11111111-1111-1111-1111-111111111111.jpg")
	if err != nil {
		t.Fatal(err)
	}
	if ext != "jpg" || thumb != "images/11111111-1111-1111-1111-111111111111.thumb.webp" {
		t.Fatalf("got %s %s", thumb, ext)
	}
	thumb, ext, err = Parse("images/safebooru/7274282.png")
	if err != nil || ext != "png" || thumb != "images/safebooru/7274282.thumb.webp" {
		t.Fatalf("seed key: %s %s %v", thumb, ext, err)
	}
	for _, bad := range []string{
		"images/../secret.jpg",
		"images/safebooru/7274282.thumb.webp",
		"other/11111111-1111-1111-1111-111111111111.jpg",
		"images/not-a-uuid.jpg",
	} {
		if _, _, err := Parse(bad); err == nil {
			t.Fatalf("accepted %s", bad)
		}
	}
}
