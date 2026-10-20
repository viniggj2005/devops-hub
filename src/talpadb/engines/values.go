package talpadbEngines

import (
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

const timestampLayout = "2006-01-02 15:04:05.999999999"

func FormatValue(value any, dateOnlyAtMidnight bool) *string {
	if value == nil {
		return nil
	}
	var text string
	switch typed := value.(type) {
	case string:
		text = typed
	case []byte:
		if utf8.Valid(typed) {
			text = string(typed)
		} else {
			text = `\x` + hex.EncodeToString(typed)
		}
	case time.Time:
		text = formatTime(typed, dateOnlyAtMidnight)
	case bool:
		text = strconv.FormatBool(typed)
	case int64:
		text = strconv.FormatInt(typed, 10)
	case float64:
		text = strconv.FormatFloat(typed, 'f', -1, 64)
	case float32:
		text = strconv.FormatFloat(float64(typed), 'f', -1, 32)
	case fmt.Stringer:
		text = typed.String()
	default:
		text = fmt.Sprint(typed)
	}
	return &text
}

func formatTime(value time.Time, dateOnlyAtMidnight bool) string {
	isMidnight := value.Hour() == 0 && value.Minute() == 0 && value.Second() == 0 && value.Nanosecond() == 0
	if dateOnlyAtMidnight && isMidnight {
		return value.Format("2006-01-02")
	}
	formatted := value.Format(timestampLayout)
	if value.Location() != time.UTC && value.Location() != time.Local {
		formatted += value.Format(" -07:00")
	}
	return formatted
}

func NormalizeTypeName(databaseTypeName string) string {
	return strings.ToLower(strings.TrimSpace(databaseTypeName))
}
