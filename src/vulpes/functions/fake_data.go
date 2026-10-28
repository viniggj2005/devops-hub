package vulpesFunctions

import (
	"fmt"
	"math/rand/v2"
	"strconv"
	"strings"
	"time"
)

const javascriptDateLayout = "Mon Jan 02 2006 15:04:05 GMT-0700"

var (
	months        = []string{"January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"}
	weekdays      = []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
	jobTypes      = []string{"Analyst", "Engineer", "Manager", "Designer", "Developer", "Specialist", "Coordinator", "Consultant"}
	jobAreas      = []string{"Data", "Brand", "Mobility", "Security", "Marketing", "Operations", "Accounts", "Infrastructure"}
	lastNames     = []string{"Silva", "Souza", "Costa", "Santos", "Oliveira", "Pereira", "Almeida", "Ferreira", "Rodrigues", "Carvalho"}
	firstNames    = []string{"Ana", "Igor", "Julia", "Lucas", "Pedro", "Bruno", "Carla", "Diego", "Elisa", "Helena", "Marina", "Felipe", "Samuel", "Olivia", "Gabriela"}
	namePrefixes  = []string{"Mr.", "Ms.", "Dr.", "Mrs.", "Miss"}
	nameSuffixes  = []string{"Jr.", "Sr.", "I", "II", "III", "MD", "PhD"}
	cities        = []string{"Curitiba", "Recife", "Salvador", "Fortaleza", "São Paulo", "Porto Alegre", "Florianópolis", "Belo Horizonte", "Rio de Janeiro"}
	streetNames   = []string{"Rua das Flores", "Avenida Brasil", "Rua XV de Novembro", "Avenida Paulista", "Rua da Praia", "Rua Sete de Setembro"}
	countries     = []string{"Brazil", "Argentina", "Chile", "Portugal", "Spain", "Canada", "Germany", "Japan", "Mexico", "United States"}
	countryCodes  = []string{"BR", "AR", "CL", "PT", "ES", "CA", "DE", "JP", "MX", "US"}
	locales       = []string{"pt_BR", "en_US", "es_ES", "fr_FR", "de_DE", "it_IT", "ja_JP"}
	protocols     = []string{"http", "https"}
	domainSuffix  = []string{"com", "net", "org", "io", "dev", "com.br", "info"}
	colors        = []string{"red", "blue", "green", "black", "white", "orange", "purple", "yellow", "silver", "turquoise"}
	departments   = []string{"Books", "Games", "Music", "Sports", "Garden", "Health", "Clothing", "Computers", "Electronics"}
	materials     = []string{"Wooden", "Steel", "Cotton", "Rubber", "Plastic", "Granite", "Concrete", "Frozen", "Fresh"}
	adjectives    = []string{"Small", "Sleek", "Rustic", "Generic", "Awesome", "Refined", "Ergonomic", "Handcrafted", "Intelligent"}
	products      = []string{"Car", "Hat", "Ball", "Shoes", "Chair", "Table", "Mouse", "Pizza", "Towels", "Keyboard", "Computer"}
	companyEnds   = []string{"Inc", "LLC", "Group", "Ltda", "and Sons", "S.A."}
	currencies    = []string{"BRL", "USD", "EUR", "GBP", "JPY", "ARS", "CAD"}
	symbols       = []string{"R$", "$", "€", "£", "¥"}
	fileTypes     = []string{"text", "image", "audio", "video", "application"}
	fileExts      = []string{"txt", "png", "jpg", "pdf", "json", "csv", "mp3", "mp4", "zip", "xml"}
	mimeTypes     = []string{"text/plain", "image/png", "image/jpeg", "application/pdf", "application/json", "text/csv", "audio/mpeg", "video/mp4"}
	databaseTypes = []string{"int", "char", "text", "date", "float", "bigint", "binary", "boolean", "varchar", "timestamp"}
	columnNames   = []string{"id", "title", "email", "status", "comment", "password", "createdAt", "updatedAt", "category", "token"}
	abbreviations = []string{"API", "CSS", "SQL", "XML", "SSL", "TCP", "RAM", "JSON", "HTTP", "HTML"}
	userAgents    = []string{
		"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
	}
	loremWords = []string{
		"lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit", "sed", "do", "eiusmod", "tempor",
		"incididunt", "ut", "labore", "et", "dolore", "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud",
	}
)

var fakeDataGenerators = map[string]func() string{
	"$randomIP":               randomIPv4,
	"$randomUrl":              randomUrl,
	"$randomBs":               func() string { return randomSentenceOf(3) },
	"$randomIPV6":             randomIPv6,
	"$randomWord":             func() string { return pick(loremWords) },
	"$randomCity":             func() string { return pick(cities) },
	"$randomPrice":            randomPrice,
	"$randomColor":            func() string { return pick(colors) },
	"$randomMonth":            func() string { return pick(months) },
	"$randomEmail":            func() string { return randomEmail(randomDomainName()) },
	"$randomWords":            func() string { return randomWordsOf(3) },
	"$randomLocale":           func() string { return pick(locales) },
	"$randomSemver":           randomSemver,
	"$randomProduct":          func() string { return pick(products) },
	"$randomCountry":          func() string { return pick(countries) },
	"$randomJobArea":          func() string { return pick(jobAreas) },
	"$randomJobType":          func() string { return pick(jobTypes) },
	"$randomWeekday":          func() string { return pick(weekdays) },
	"$randomFileExt":          func() string { return pick(fileExts) },
	"$randomBitcoin":          randomBitcoinAddress,
	"$randomHexColor":         randomHexColor,
	"$randomPassword":         func() string { return randomCharacters(alphaNumericCharacters, 15) },
	"$randomFileName":         func() string { return pick(loremWords) + "_" + pick(loremWords) + "." + pick(fileExts) },
	"$randomFileType":         func() string { return pick(fileTypes) },
	"$randomJobTitle":         func() string { return pick(jobAreas) + " " + pick(jobTypes) },
	"$randomLastName":         func() string { return pick(lastNames) },
	"$randomLatitude":         func() string { return randomCoordinate(90) },
	"$randomMimeType":         func() string { return pick(mimeTypes) },
	"$randomUserName":         randomUserName,
	"$randomFullName":         func() string { return pick(firstNames) + " " + pick(lastNames) },
	"$randomLoremWord":        func() string { return pick(loremWords) },
	"$randomLongitude":        func() string { return randomCoordinate(180) },
	"$randomProtocol":         func() string { return pick(protocols) },
	"$randomFirstName":        func() string { return pick(firstNames) },
	"$randomNamePrefix":       func() string { return pick(namePrefixes) },
	"$randomNameSuffix":       func() string { return pick(nameSuffixes) },
	"$randomLoremSlug":        func() string { return strings.ReplaceAll(randomWordsOf(3), " ", "-") },
	"$randomLoremText":        func() string { return randomParagraphOf(3) },
	"$randomDatePast":         func() string { return randomDate(-365 * 24 * time.Hour) },
	"$randomUserAgent":        func() string { return pick(userAgents) },
	"$randomMACAddress":       randomMacAddress,
	"$randomDepartment":       func() string { return pick(departments) },
	"$randomLoremWords":       func() string { return randomWordsOf(3) },
	"$randomLoremLines":       func() string { return strings.Join([]string{randomSentenceOf(6), randomSentenceOf(6)}, "\n") },
	"$randomDomainWord":       func() string { return strings.ToLower(pick(lastNames)) },
	"$randomDateFuture":       func() string { return randomDate(365 * 24 * time.Hour) },
	"$randomDateRecent":       func() string { return randomDate(-48 * time.Hour) },
	"$randomCountryCode":      func() string { return pick(countryCodes) },
	"$randomStreetName":       func() string { return pick(streetNames) },
	"$randomDomainName":       randomDomainName,
	"$randomPhoneNumber":      randomPhoneNumber,
	"$randomBankAccount":      func() string { return randomDigits(8) },
	"$randomCompanyName":      func() string { return pick(lastNames) + " " + pick(companyEnds) },
	"$randomProductName":      func() string { return pick(adjectives) + " " + pick(materials) + " " + pick(products) },
	"$randomCatchPhrase":      func() string { return randomSentenceOf(4) },
	"$randomAvatarImage":      func() string { return fmt.Sprintf("https://i.pravatar.cc/150?img=%d", rand.IntN(70)+1) },
	"$randomImageUrl":         func() string { return fmt.Sprintf("https://picsum.photos/seed/%s/640/480", randomDigits(6)) },
	"$randomDomainSuffix":     func() string { return pick(domainSuffix) },
	"$randomExampleEmail":     func() string { return randomEmail("example." + pick([]string{"com", "net", "org"})) },
	"$randomAbbreviation":     func() string { return pick(abbreviations) },
	"$randomCurrencyCode":     func() string { return pick(currencies) },
	"$randomDatabaseType":     func() string { return pick(databaseTypes) },
	"$randomLoremSentence":    func() string { return randomSentenceOf(8) },
	"$randomStreetAddress":    func() string { return fmt.Sprintf("%s, %d", pick(streetNames), rand.IntN(9000)+1) },
	"$randomCompanySuffix":    func() string { return pick(companyEnds) },
	"$randomPhoneNumberExt":   func() string { return randomDigits(2) + "-" + randomPhoneNumber() },
	"$randomLoremSentences":   func() string { return randomParagraphOf(3) },
	"$randomLoremParagraph":   func() string { return randomParagraphOf(5) },
	"$randomDatabaseColumn":   func() string { return pick(columnNames) },
	"$randomCurrencySymbol":   func() string { return pick(symbols) },
	"$randomCreditCardMask":   func() string { return randomDigits(4) },
	"$randomProductMaterial":  func() string { return pick(materials) },
	"$randomJobDescriptor":    func() string { return pick(adjectives) },
	"$randomProductAdjective": func() string { return pick(adjectives) },
}

func dynamicVariable(name string) (func() string, bool) {
	if generate, found := dynamicVariables[name]; found {
		return generate, true
	}
	generate, found := fakeDataGenerators[name]
	return generate, found
}

func IsDynamicVariable(name string) bool {
	_, found := dynamicVariable(name)
	return found
}

func pick(options []string) string {
	return options[rand.IntN(len(options))]
}

func randomCharacters(alphabet string, length int) string {
	var builder strings.Builder
	for range length {
		builder.WriteByte(alphabet[rand.IntN(len(alphabet))])
	}
	return builder.String()
}

func randomDigits(length int) string {
	return randomCharacters("0123456789", length)
}

func randomWordsOf(count int) string {
	words := make([]string, count)
	for position := range words {
		words[position] = pick(loremWords)
	}
	return strings.Join(words, " ")
}

func randomSentenceOf(wordCount int) string {
	sentence := randomWordsOf(wordCount)
	return strings.ToUpper(sentence[:1]) + sentence[1:] + "."
}

func randomParagraphOf(sentenceCount int) string {
	sentences := make([]string, sentenceCount)
	for position := range sentences {
		sentences[position] = randomSentenceOf(rand.IntN(6) + 5)
	}
	return strings.Join(sentences, " ")
}

func randomUserName() string {
	separator := pick([]string{".", "_", ""})
	return pick(firstNames) + separator + pick(lastNames) + strconv.Itoa(rand.IntN(100))
}

func randomEmail(domain string) string {
	return strings.ToLower(pick(firstNames)+"."+pick(lastNames)) + strconv.Itoa(rand.IntN(100)) + "@" + domain
}

func randomDomainName() string {
	return strings.ToLower(pick(lastNames)) + "." + pick(domainSuffix)
}

func randomUrl() string {
	return pick(protocols) + "://" + randomDomainName()
}

func randomIPv4() string {
	return fmt.Sprintf("%d.%d.%d.%d", rand.IntN(256), rand.IntN(256), rand.IntN(256), rand.IntN(256))
}

func randomIPv6() string {
	groups := make([]string, 8)
	for position := range groups {
		groups[position] = fmt.Sprintf("%x", rand.IntN(0x10000))
	}
	return strings.Join(groups, ":")
}

func randomMacAddress() string {
	octets := make([]string, 6)
	for position := range octets {
		octets[position] = fmt.Sprintf("%02x", rand.IntN(256))
	}
	return strings.Join(octets, ":")
}

func randomHexColor() string {
	return fmt.Sprintf("#%06x", rand.IntN(0x1000000))
}

func randomSemver() string {
	return fmt.Sprintf("%d.%d.%d", rand.IntN(10), rand.IntN(10), rand.IntN(10))
}

func randomPrice() string {
	return fmt.Sprintf("%d.%02d", rand.IntN(1000), rand.IntN(100))
}

func randomCoordinate(limit int) string {
	return strconv.FormatFloat((rand.Float64()*2-1)*float64(limit), 'f', 4, 64)
}

func randomPhoneNumber() string {
	return fmt.Sprintf("(%s) 9%s-%s", randomDigits(2), randomDigits(4), randomDigits(4))
}

func randomBitcoinAddress() string {
	return "1" + randomCharacters("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz", 33)
}

func randomDate(maximumOffset time.Duration) string {
	offset := time.Duration(rand.Int64N(int64(max(maximumOffset, -maximumOffset)) + 1))
	if maximumOffset < 0 {
		offset = -offset
	}
	return time.Now().Add(offset).Format(javascriptDateLayout)
}
