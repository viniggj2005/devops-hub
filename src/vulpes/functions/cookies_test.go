package vulpesFunctions

import (
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	vulpesDtos "docker-manager-go/src/vulpes/dtos"
)

func cookieNames(cookies []*http.Cookie) string {
	names := make([]string, 0, len(cookies))
	for _, cookie := range cookies {
		names = append(names, cookie.Name+"="+cookie.Value)
	}
	return strings.Join(names, "; ")
}

func mustParseUrl(test *testing.T, rawUrl string) *url.URL {
	test.Helper()
	parsed, err := url.Parse(rawUrl)
	if err != nil {
		test.Fatalf("unexpected url error: %v", err)
	}
	return parsed
}

func TestCookieJarMatchesDomainPathSecureAndExpiry(test *testing.T) {
	now := time.Date(2026, 5, 1, 12, 0, 0, 0, time.UTC)
	jar := NewCookieJar([]vulpesDtos.CookieDto{
		{Name: "host", Value: "1", Domain: "api.example.dev", Path: "/", HostOnly: true},
		{Name: "shared", Value: "2", Domain: "example.dev", Path: "/"},
		{Name: "admin", Value: "3", Domain: "example.dev", Path: "/admin"},
		{Name: "secure", Value: "4", Domain: "example.dev", Path: "/", Secure: true},
		{Name: "old", Value: "5", Domain: "example.dev", Path: "/", Expires: FormatCookieTime(now.Add(-time.Hour))},
	})
	jar.now = func() time.Time { return now }

	if got := cookieNames(jar.Cookies(mustParseUrl(test, "https://api.example.dev/admin/users"))); got != "admin=3; host=1; shared=2; secure=4" {
		test.Fatalf("unexpected cookies for api host: %q", got)
	}
	if got := cookieNames(jar.Cookies(mustParseUrl(test, "http://web.example.dev/administrator"))); got != "shared=2" {
		test.Fatalf("host-only, secure and path rules were not applied: %q", got)
	}
	if got := cookieNames(jar.Cookies(mustParseUrl(test, "http://example.dev.evil.io/"))); got != "" {
		test.Fatalf("cookies must not leak to other domains: %q", got)
	}
}

func TestCookieJarStoresUpdatesAndDeletesReceivedCookies(test *testing.T) {
	now := time.Date(2026, 5, 1, 12, 0, 0, 0, time.UTC)
	stored := []vulpesDtos.CookieDto{{Name: "session", Value: "old", Domain: "a.example.dev", Path: "/", HostOnly: true}}
	jar := NewCookieJar(stored)
	jar.now = func() time.Time { return now }
	target := mustParseUrl(test, "https://a.example.dev/v1/users")

	jar.SetCookies(target, []*http.Cookie{
		{Name: "session", Value: "new", Path: "/"},
		{Name: "theme", Value: "dark", Domain: ".example.dev", Path: "/", MaxAge: 60},
		{Name: "foreign", Value: "x", Domain: "other.dev"},
		{Name: "tld", Value: "x", Domain: "dev"},
		{Name: "scoped", Value: "y"},
	})
	if got := cookieNames(jar.Cookies(mustParseUrl(test, "https://b.example.dev/"))); got != "theme=dark" {
		test.Fatalf("domain cookie must reach sibling subdomains: %q", got)
	}
	if got := cookieNames(jar.Cookies(mustParseUrl(test, "https://a.example.dev/v1/orders"))); got != "scoped=y; session=new; theme=dark" {
		test.Fatalf("unexpected cookies after update: %q", got)
	}

	changes := jar.Changes()
	if len(changes) != 3 {
		test.Fatalf("rejected cookies must not be recorded: %+v", changes)
	}
	if changes[1].Domain != "example.dev" || changes[1].HostOnly || changes[1].Expires != FormatCookieTime(now.Add(time.Minute)) {
		test.Fatalf("unexpected domain cookie: %+v", changes[1])
	}
	if changes[2].Path != "/v1" || !changes[2].HostOnly || changes[2].Domain != "a.example.dev" {
		test.Fatalf("expected default path and host-only cookie: %+v", changes[2])
	}

	merged := ApplyCookieChanges(stored, changes, now)
	if len(merged) != 3 || merged[0].Value != "new" || stored[0].Value != "old" {
		test.Fatalf("changes must replace the stored cookie without mutating the original: %+v %+v", merged, stored)
	}

	jar.SetCookies(target, []*http.Cookie{{Name: "session", Path: "/", MaxAge: -1}})
	if got := cookieNames(jar.Cookies(target)); got != "scoped=y; theme=dark" {
		test.Fatalf("Max-Age=0 must delete the cookie: %q", got)
	}
	if final := ApplyCookieChanges(stored, jar.Changes(), now); len(final) != 2 {
		test.Fatalf("deletion must be replayed on the stored cookies: %+v", final)
	}
}

func TestValidateAndNormalizeCookies(test *testing.T) {
	now := time.Date(2026, 5, 1, 12, 0, 0, 0, time.UTC)
	for name, cookie := range map[string]vulpesDtos.CookieDto{
		"empty name":     {Name: " ", Domain: "x.dev"},
		"invalid name":   {Name: "a b", Domain: "x.dev"},
		"invalid value":  {Name: "a", Value: `"quoted"`, Domain: "x.dev"},
		"missing domain": {Name: "a", Domain: " . "},
		"bad expiry":     {Name: "a", Domain: "x.dev", Expires: "amanhã"},
	} {
		if err := ValidateCookies([]vulpesDtos.CookieDto{cookie}); err == nil {
			test.Fatalf("expected %s to fail", name)
		}
	}
	if err := ValidateCookies([]vulpesDtos.CookieDto{{Name: "a", Value: "b c", Domain: "x.dev", Expires: "2030-01-01T00:00:00Z"}}); err != nil {
		test.Fatalf("unexpected validation error: %v", err)
	}

	normalized := NormalizeCookies([]vulpesDtos.CookieDto{
		{Name: " a ", Value: "1", Domain: ".X.dev", SameSite: "lax", Expires: "Thu, 01 Jan 2032 00:00:00 GMT"},
		{Name: "a", Value: "2", Domain: "x.dev", Path: "/", SameSite: "weird"},
		{Name: "gone", Domain: "x.dev", Expires: "2020-01-01T00:00:00Z"},
		{Name: "", Domain: "x.dev"},
	}, now)
	if len(normalized) != 1 {
		test.Fatalf("expected duplicates, expired and unnamed cookies to be dropped: %+v", normalized)
	}
	if cookie := normalized[0]; cookie.Name != "a" || cookie.Value != "2" || cookie.Domain != "x.dev" || cookie.Path != "/" || cookie.SameSite != "" {
		test.Fatalf("unexpected normalized cookie: %+v", cookie)
	}
	if first := NormalizeCookies([]vulpesDtos.CookieDto{{Name: "a", Domain: "x.dev", SameSite: "STRICT", Expires: "Thu, 01 Jan 2032 00:00:00 GMT"}}, now)[0]; first.SameSite != "Strict" || first.Expires != "2032-01-01T00:00:00Z" {
		test.Fatalf("expected SameSite and expiry to be normalized: %+v", first)
	}
}
