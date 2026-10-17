// The module path is the DOWNLOAD ADDRESS: `go get` fetches exactly this URL,
// so it must match the public mirror github.com/Misar-AI/misarseo-sdks, which
// keeps each language in a subdirectory — hence the /go suffix, and release
// tags of the form `go/vX.Y.Z`. (A `/v1` suffix is not allowed: Go reserves
// major-version suffixes for v2 and up, and rejects `/v1` as malformed.)
module github.com/Misar-AI/misarseo-sdks/go

go 1.22
