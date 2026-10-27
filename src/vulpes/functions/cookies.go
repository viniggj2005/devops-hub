package vulpesFunctions

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	vulpesDtos "docker-manager-go/src/vulpes/dtos"
)

const cookieTimeLayout = time.RFC3339

var cookieTimeLayouts = []string{time.RFC3339, http.TimeFormat, time.RFC1123, time.RFC1123Z}

var sameSiteNames = map[http.SameSite]string{
	http.SameSiteLaxMode:    "Lax",
	http.SameSiteNoneMode:   "None",
	http.SameSiteStrictMode: "Strict",
}

var supportedSameSites = map[string]string{"lax": "Lax", "none": "None", "strict": "Strict"}

type CookieJar struct {
	mutex   sync.Mutex
	now     func() time.Time
	cookies []vulpesDtos.CookieDto
	changes []vulpesDtos.CookieDto
}

func NewCookieJar(cookies []vulpesDtos.CookieDto) *CookieJar {
	return &CookieJar{now: time.Now, cookies: append([]vulpesDtos.CookieDto{}, cookies...)}
}

func (jar *CookieJar) Cookies(target *url.URL) []*http.Cookie {
	jar.mutex.Lock()
	defer jar.mutex.Unlock()

	now := jar.now()
	host := canonicalHost(target)
	path := requestPath(target)
	secure := target.Scheme == "https" || target.Scheme == "wss"

	matched := []vulpesDtos.CookieDto{}
	for _, cookie := range jar.cookies {
		if IsCookieExpired(cookie, now) || (cookie.Secure && !secure) || !cookieDomainMatches(cookie, host) || !cookiePathMatches(cookie.Path, path) {
			continue
		}
		matched = append(matched, cookie)
	}
	sort.SliceStable(matched, func(left int, right int) bool { return len(matched[left].Path) > len(matched[right].Path) })

	result := make([]*http.Cookie, 0, len(matched))
	for _, cookie := range matched {
		result = append(result, &http.Cookie{Name: cookie.Name, Value: cookie.Value})
	}
	return result
}

func (jar *CookieJar) SetCookies(target *url.URL, received []*http.Cookie) {
	jar.mutex.Lock()
	defer jar.mutex.Unlock()

	now := jar.now()
	for _, cookie := range received {
		stored, accepted := cookieFromResponse(target, cookie, now)
		if !accepted {
			continue
		}
		jar.cookies = ApplyCookieChanges(jar.cookies, []vulpesDtos.CookieDto{stored}, now)
		jar.changes = append(jar.changes, stored)
	}
}

func (jar *CookieJar) Changes() []vulpesDtos.CookieDto {
	jar.mutex.Lock()
	defer jar.mutex.Unlock()
	return append([]vulpesDtos.CookieDto{}, jar.changes...)
}

func ResponseCookie(cookie *http.Cookie, now time.Time) vulpesDtos.CookieDto {
	return vulpesDtos.CookieDto{
		Name:     cookie.Name,
		Path:     cookie.Path,
		Value:    cookie.Value,
		Domain:   cookie.Domain,
		Secure:   cookie.Secure,
		Expires:  cookieExpiry(cookie, now),
		HttpOnly: cookie.HttpOnly,
		SameSite: sameSiteNames[cookie.SameSite],
	}
}

func ApplyCookieChanges(cookies []vulpesDtos.CookieDto, changes []vulpesDtos.CookieDto, now time.Time) []vulpesDtos.CookieDto {
	result := append([]vulpesDtos.CookieDto{}, cookies...)
	for _, change := range changes {
		result = upsertCookie(result, change, now)
	}
	return pruneExpiredCookies(result, now)
}

func NormalizeCookies(cookies []vulpesDtos.CookieDto, now time.Time) []vulpesDtos.CookieDto {
	normalized := make([]vulpesDtos.CookieDto, 0, len(cookies))
	for _, cookie := range cookies {
		cookie.Name = strings.TrimSpace(cookie.Name)
		cookie.Path = strings.TrimSpace(cookie.Path)
		cookie.Domain = normalizeCookieDomain(cookie.Domain)
		cookie.SameSite = supportedSameSites[strings.ToLower(strings.TrimSpace(cookie.SameSite))]
		if !strings.HasPrefix(cookie.Path, "/") {
			cookie.Path = "/"
		}
		if expires, valid := parseCookieTime(cookie.Expires); valid {
			cookie.Expires = expires
		} else {
			cookie.Expires = ""
		}
		if cookie.Name == "" || cookie.Domain == "" {
			continue
		}
		normalized = upsertCookie(normalized, cookie, now)
	}
	return normalized
}

func ValidateCookies(cookies []vulpesDtos.CookieDto) error {
	for _, cookie := range cookies {
		name := strings.TrimSpace(cookie.Name)
		if name == "" {
			return errors.New("informe o nome de todos os cookies")
		}
		if !isCookieToken(name) {
			return fmt.Errorf("o nome do cookie %q contém caracteres inválidos", name)
		}
		if !isCookieValue(cookie.Value) {
			return fmt.Errorf("o valor do cookie %q não pode conter aspas, ponto e vírgula, barra invertida ou caracteres de controle", name)
		}
		if normalizeCookieDomain(cookie.Domain) == "" {
			return fmt.Errorf("informe o domínio do cookie %q", name)
		}
		if _, valid := parseCookieTime(cookie.Expires); !valid {
			return fmt.Errorf("a data de expiração do cookie %q é inválida", name)
		}
	}
	return nil
}

func IsCookieExpired(cookie vulpesDtos.CookieDto, now time.Time) bool {
	if cookie.Expires == "" {
		return false
	}
	expires, err := time.Parse(cookieTimeLayout, cookie.Expires)
	return err == nil && !expires.After(now)
}

func FormatCookieTime(moment time.Time) string {
	return moment.UTC().Format(cookieTimeLayout)
}

func ParseCookieTime(text string) (time.Time, bool) {
	trimmed := strings.TrimSpace(text)
	for _, layout := range cookieTimeLayouts {
		if parsed, err := time.Parse(layout, trimmed); err == nil {
			return parsed, true
		}
	}
	return time.Time{}, false
}

func parseCookieTime(text string) (string, bool) {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" || strings.EqualFold(trimmed, "Infinity") {
		return "", true
	}
	parsed, valid := ParseCookieTime(trimmed)
	if !valid {
		return "", false
	}
	return FormatCookieTime(parsed), true
}

func cookieFromResponse(target *url.URL, cookie *http.Cookie, now time.Time) (vulpesDtos.CookieDto, bool) {
	host := canonicalHost(target)
	if cookie.Name == "" || host == "" {
		return vulpesDtos.CookieDto{}, false
	}

	stored := ResponseCookie(cookie, now)
	stored.Domain = normalizeCookieDomain(cookie.Domain)
	switch {
	case stored.Domain == "":
		stored.Domain, stored.HostOnly = host, true
	case !hostMatchesDomain(host, stored.Domain):
		return vulpesDtos.CookieDto{}, false
	case stored.Domain != host && !strings.Contains(stored.Domain, "."):
		return vulpesDtos.CookieDto{}, false
	}
	if !strings.HasPrefix(stored.Path, "/") {
		stored.Path = defaultCookiePath(requestPath(target))
	}
	return stored, true
}

func cookieExpiry(cookie *http.Cookie, now time.Time) string {
	switch {
	case cookie.MaxAge < 0:
		return FormatCookieTime(now.Add(-time.Second))
	case cookie.MaxAge > 0:
		return FormatCookieTime(now.Add(time.Duration(cookie.MaxAge) * time.Second))
	case !cookie.Expires.IsZero():
		return FormatCookieTime(cookie.Expires)
	}
	return ""
}

func upsertCookie(cookies []vulpesDtos.CookieDto, cookie vulpesDtos.CookieDto, now time.Time) []vulpesDtos.CookieDto {
	expired := IsCookieExpired(cookie, now)
	for position, existing := range cookies {
		if !sameCookie(existing, cookie) {
			continue
		}
		if expired {
			return append(cookies[:position:position], cookies[position+1:]...)
		}
		cookies[position] = cookie
		return cookies
	}
	if expired {
		return cookies
	}
	return append(cookies, cookie)
}

func pruneExpiredCookies(cookies []vulpesDtos.CookieDto, now time.Time) []vulpesDtos.CookieDto {
	alive := make([]vulpesDtos.CookieDto, 0, len(cookies))
	for _, cookie := range cookies {
		if !IsCookieExpired(cookie, now) {
			alive = append(alive, cookie)
		}
	}
	return alive
}

func sameCookie(left vulpesDtos.CookieDto, right vulpesDtos.CookieDto) bool {
	return left.Name == right.Name && left.Path == right.Path && strings.EqualFold(left.Domain, right.Domain)
}

func cookieDomainMatches(cookie vulpesDtos.CookieDto, host string) bool {
	if cookie.HostOnly {
		return host == strings.ToLower(cookie.Domain)
	}
	return hostMatchesDomain(host, strings.ToLower(cookie.Domain))
}

func hostMatchesDomain(host string, domain string) bool {
	if host == domain {
		return true
	}
	return net.ParseIP(host) == nil && strings.HasSuffix(host, "."+domain)
}

func cookiePathMatches(cookiePath string, path string) bool {
	if path == cookiePath {
		return true
	}
	if !strings.HasPrefix(path, cookiePath) {
		return false
	}
	return strings.HasSuffix(cookiePath, "/") || path[len(cookiePath)] == '/'
}

func defaultCookiePath(path string) string {
	lastSlash := strings.LastIndex(path, "/")
	if lastSlash <= 0 {
		return "/"
	}
	return path[:lastSlash]
}

func normalizeCookieDomain(domain string) string {
	return strings.ToLower(strings.TrimPrefix(strings.TrimSpace(domain), "."))
}

func canonicalHost(target *url.URL) string {
	return strings.ToLower(target.Hostname())
}

func requestPath(target *url.URL) string {
	if target.Path == "" || !strings.HasPrefix(target.Path, "/") {
		return "/"
	}
	return target.Path
}

func isCookieToken(name string) bool {
	for _, character := range name {
		if character <= ' ' || character >= 0x7f || strings.ContainsRune(`()<>@,;:\"/[]?={}`, character) {
			return false
		}
	}
	return true
}

func isCookieValue(value string) bool {
	for _, character := range value {
		if character < ' ' || character >= 0x7f || character == '"' || character == ';' || character == '\\' {
			return false
		}
	}
	return true
}
