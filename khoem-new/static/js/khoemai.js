/* khoemai.js */
document.addEventListener("DOMContentLoaded", function () {
    const countries = [
        { name: "Afghanistan",                    native: "افغانستان",                         flag: "🇦🇫", tz: "Asia/Kabul" },
        { name: "Albania",                        native: "Shqipëria",                         flag: "🇦🇱", tz: "Europe/Tirane" },
        { name: "Algeria",                        native: "الجزائر",                           flag: "🇩🇿", tz: "Africa/Algiers" },
        { name: "Andorra",                        native: "Andorra",                           flag: "🇦🇩", tz: "Europe/Andorra" },
        { name: "Angola",                         native: "Angola",                            flag: "🇦🇴", tz: "Africa/Luanda" },
        { name: "Antigua and Barbuda",            native: "Antigua and Barbuda",               flag: "🇦🇬", tz: "America/Antigua" },
        { name: "Argentina",                      native: "Argentina",                         flag: "🇦🇷", tz: "America/Argentina/Buenos_Aires" },
        { name: "Armenia",                        native: "Հայաստան",                          flag: "🇦🇲", tz: "Asia/Yerevan" },
        { name: "Australia",                      native: "Australia",                         flag: "🇦🇺", tz: "Australia/Sydney" },
        { name: "Austria",                        native: "Österreich",                        flag: "🇦🇹", tz: "Europe/Vienna" },
        { name: "Azerbaijan",                     native: "Azərbaycan",                        flag: "🇦🇿", tz: "Asia/Baku" },
        { name: "Bahamas",                        native: "Bahamas",                           flag: "🇧🇸", tz: "America/Nassau" },
        { name: "Bahrain",                        native: "البحرين",                           flag: "🇧🇭", tz: "Asia/Bahrain" },
        { name: "Bangladesh",                     native: "বাংলাদেশ",                          flag: "🇧🇩", tz: "Asia/Dhaka" },
        { name: "Barbados",                       native: "Barbados",                          flag: "🇧🇧", tz: "America/Barbados" },
        { name: "Belarus",                        native: "Беларусь",                          flag: "🇧🇾", tz: "Europe/Minsk" },
        { name: "Belgium",                        native: "België",                            flag: "🇧🇪", tz: "Europe/Brussels" },
        { name: "Belize",                         native: "Belize",                            flag: "🇧🇿", tz: "America/Belize" },
        { name: "Benin",                          native: "Bénin",                             flag: "🇧🇯", tz: "Africa/Porto-Novo" },
        { name: "Bhutan",                         native: "འབྲུག་ཡུལ་",                         flag: "🇧🇹", tz: "Asia/Thimphu" },
        { name: "Bolivia",                        native: "Bolivia",                           flag: "🇧🇴", tz: "America/La_Paz" },
        { name: "Bosnia and Herzegovina",         native: "Bosna i Hercegovina",               flag: "🇧🇦", tz: "Europe/Sarajevo" },
        { name: "Botswana",                       native: "Botswana",                          flag: "🇧🇼", tz: "Africa/Gaborone" },
        { name: "Brazil",                         native: "Brasil",                            flag: "🇧🇷", tz: "America/Sao_Paulo" },
        { name: "Brunei",                         native: "بروني",                             flag: "🇧🇳", tz: "Asia/Brunei" },
        { name: "Bulgaria",                       native: "България",                          flag: "🇧🇬", tz: "Europe/Sofia" },
        { name: "Burkina Faso",                   native: "Burkina Faso",                      flag: "🇧🇫", tz: "Africa/Ouagadougou" },
        { name: "Burundi",                        native: "Burundi",                           flag: "🇧🇮", tz: "Africa/Bujumbura" },
        { name: "Cambodia",                       native: "កម្ពុជា",                            flag: "🇰🇭", tz: "Asia/Phnom_Penh" },
        { name: "Cameroon",                       native: "Cameroun",                          flag: "🇨🇲", tz: "Africa/Douala" },
        { name: "Canada",                         native: "Canada",                            flag: "🇨🇦", tz: "America/Toronto" },
        { name: "Cape Verde",                     native: "Cabo Verde",                        flag: "🇨🇻", tz: "Atlantic/Cape_Verde" },
        { name: "Central African Republic",       native: "République centrafricaine",         flag: "🇨🇫", tz: "Africa/Bangui" },
        { name: "Chad",                           native: "تشاد",                              flag: "🇹🇩", tz: "Africa/Ndjamena" },
        { name: "Chile",                          native: "Chile",                             flag: "🇨🇱", tz: "America/Santiago" },
        { name: "China",                          native: "中国",                               flag: "🇨🇳", tz: "Asia/Shanghai" },
        { name: "Colombia",                       native: "Colombia",                          flag: "🇨🇴", tz: "America/Bogota" },
        { name: "Comoros",                        native: "جزر القمر",                         flag: "🇰🇲", tz: "Indian/Comoro" },
        { name: "Congo",                          native: "Congo",                             flag: "🇨🇬", tz: "Africa/Brazzaville" },
        { name: "Costa Rica",                     native: "Costa Rica",                        flag: "🇨🇷", tz: "America/Costa_Rica" },
        { name: "Croatia",                        native: "Hrvatska",                          flag: "🇭🇷", tz: "Europe/Zagreb" },
        { name: "Cuba",                           native: "Cuba",                              flag: "🇨🇺", tz: "America/Havana" },
        { name: "Cyprus",                         native: "Κύπρος",                            flag: "🇨🇾", tz: "Asia/Nicosia" },
        { name: "Czech Republic",                 native: "Česká republika",                   flag: "🇨🇿", tz: "Europe/Prague" },
        { name: "Denmark",                        native: "Danmark",                           flag: "🇩🇰", tz: "Europe/Copenhagen" },
        { name: "Djibouti",                       native: "جيبوتي",                            flag: "🇩🇯", tz: "Africa/Djibouti" },
        { name: "Dominica",                       native: "Dominica",                          flag: "🇩🇲", tz: "America/Dominica" },
        { name: "Dominican Republic",             native: "República Dominicana",              flag: "🇩🇴", tz: "America/Santo_Domingo" },
        { name: "Ecuador",                        native: "Ecuador",                           flag: "🇪🇨", tz: "America/Guayaquil" },
        { name: "Egypt",                          native: "مصر",                               flag: "🇪🇬", tz: "Africa/Cairo" },
        { name: "El Salvador",                    native: "El Salvador",                       flag: "🇸🇻", tz: "America/El_Salvador" },
        { name: "Equatorial Guinea",              native: "Guinea Ecuatorial",                 flag: "🇬🇶", tz: "Africa/Malabo" },
        { name: "Eritrea",                        native: "ኤርትራ",                             flag: "🇪🇷", tz: "Africa/Asmara" },
        { name: "Estonia",                        native: "Eesti",                             flag: "🇪🇪", tz: "Europe/Tallinn" },
        { name: "Eswatini",                       native: "Eswatini",                          flag: "🇸🇿", tz: "Africa/Mbabane" },
        { name: "Ethiopia",                       native: "ኢትዮጵያ",                            flag: "🇪🇹", tz: "Africa/Addis_Ababa" },
        { name: "Fiji",                           native: "Fiji",                              flag: "🇫🇯", tz: "Pacific/Fiji" },
        { name: "Finland",                        native: "Suomi",                             flag: "🇫🇮", tz: "Europe/Helsinki" },
        { name: "France",                         native: "France",                            flag: "🇫🇷", tz: "Europe/Paris" },
        { name: "Gabon",                          native: "Gabon",                             flag: "🇬🇦", tz: "Africa/Libreville" },
        { name: "Gambia",                         native: "Gambia",                            flag: "🇬🇲", tz: "Africa/Banjul" },
        { name: "Georgia",                        native: "საქართველო",                        flag: "🇬🇪", tz: "Asia/Tbilisi" },
        { name: "Germany",                        native: "Deutschland",                       flag: "🇩🇪", tz: "Europe/Berlin" },
        { name: "Ghana",                          native: "Ghana",                             flag: "🇬🇭", tz: "Africa/Accra" },
        { name: "Greece",                         native: "Ελλάδα",                            flag: "🇬🇷", tz: "Europe/Athens" },
        { name: "Grenada",                        native: "Grenada",                           flag: "🇬🇩", tz: "America/Grenada" },
        { name: "Guatemala",                      native: "Guatemala",                         flag: "🇬🇹", tz: "America/Guatemala" },
        { name: "Guinea",                         native: "Guinée",                            flag: "🇬🇳", tz: "Africa/Conakry" },
        { name: "Guinea-Bissau",                  native: "Guiné-Bissau",                      flag: "🇬🇼", tz: "Africa/Bissau" },
        { name: "Guyana",                         native: "Guyana",                            flag: "🇬🇾", tz: "America/Guyana" },
        { name: "Haiti",                          native: "Haïti",                             flag: "🇭🇹", tz: "America/Port-au-Prince" },
        { name: "Honduras",                       native: "Honduras",                          flag: "🇭🇳", tz: "America/Tegucigalpa" },
        { name: "Hungary",                        native: "Magyarország",                      flag: "🇭🇺", tz: "Europe/Budapest" },
        { name: "Iceland",                        native: "Ísland",                            flag: "🇮🇸", tz: "Atlantic/Reykjavik" },
        { name: "India",                          native: "भारत",                              flag: "🇮🇳", tz: "Asia/Kolkata" },
        { name: "Indonesia",                      native: "Indonesia",                         flag: "🇮🇩", tz: "Asia/Jakarta" },
        { name: "Iran",                           native: "ایران",                             flag: "🇮🇷", tz: "Asia/Tehran" },
        { name: "Iraq",                           native: "العراق",                            flag: "🇮🇶", tz: "Asia/Baghdad" },
        { name: "Ireland",                        native: "Éire",                              flag: "🇮🇪", tz: "Europe/Dublin" },
        { name: "Israel",                         native: "ישראל",                             flag: "🇮🇱", tz: "Asia/Jerusalem" },
        { name: "Italy",                          native: "Italia",                            flag: "🇮🇹", tz: "Europe/Rome" },
        { name: "Jamaica",                        native: "Jamaica",                           flag: "🇯🇲", tz: "America/Jamaica" },
        { name: "Japan",                          native: "日本",                               flag: "🇯🇵", tz: "Asia/Tokyo" },
        { name: "Jordan",                         native: "الأردن",                            flag: "🇯🇴", tz: "Asia/Amman" },
        { name: "Kazakhstan",                     native: "Қазақстан",                         flag: "🇰🇿", tz: "Asia/Almaty" },
        { name: "Kenya",                          native: "Kenya",                             flag: "🇰🇪", tz: "Africa/Nairobi" },
        { name: "Kiribati",                       native: "Kiribati",                          flag: "🇰🇮", tz: "Pacific/Tarawa" },
        { name: "North Korea",                    native: "조선",                               flag: "🇰🇵", tz: "Asia/Pyongyang" },
        { name: "South Korea",                    native: "대한민국",                            flag: "🇰🇷", tz: "Asia/Seoul" },
        { name: "Kuwait",                         native: "الكويت",                            flag: "🇰🇼", tz: "Asia/Kuwait" },
        { name: "Kyrgyzstan",                     native: "Кыргызстан",                        flag: "🇰🇬", tz: "Asia/Bishkek" },
        { name: "Laos",                           native: "ລາວ",                               flag: "🇱🇦", tz: "Asia/Vientiane" },
        { name: "Latvia",                         native: "Latvija",                           flag: "🇱🇻", tz: "Europe/Riga" },
        { name: "Lebanon",                        native: "لبنان",                             flag: "🇱🇧", tz: "Asia/Beirut" },
        { name: "Lesotho",                        native: "Lesotho",                           flag: "🇱🇸", tz: "Africa/Maseru" },
        { name: "Liberia",                        native: "Liberia",                           flag: "🇱🇷", tz: "Africa/Monrovia" },
        { name: "Libya",                          native: "ليبيا",                             flag: "🇱🇾", tz: "Africa/Tripoli" },
        { name: "Liechtenstein",                  native: "Liechtenstein",                     flag: "🇱🇮", tz: "Europe/Vaduz" },
        { name: "Lithuania",                      native: "Lietuva",                           flag: "🇱🇹", tz: "Europe/Vilnius" },
        { name: "Luxembourg",                     native: "Luxembourg",                        flag: "🇱🇺", tz: "Europe/Luxembourg" },
        { name: "Madagascar",                     native: "Madagasikara",                      flag: "🇲🇬", tz: "Indian/Antananarivo" },
        { name: "Malawi",                         native: "Malawi",                            flag: "🇲🇼", tz: "Africa/Blantyre" },
        { name: "Malaysia",                       native: "Malaysia",                          flag: "🇲🇾", tz: "Asia/Kuala_Lumpur" },
        { name: "Maldives",                       native: "ދިވެހިރާއްޖެ",                      flag: "🇲🇻", tz: "Indian/Maldives" },
        { name: "Mali",                           native: "Mali",                              flag: "🇲🇱", tz: "Africa/Bamako" },
        { name: "Malta",                          native: "Malta",                             flag: "🇲🇹", tz: "Europe/Malta" },
        { name: "Marshall Islands",               native: "M̧ajeel",                           flag: "🇲🇭", tz: "Pacific/Majuro" },
        { name: "Mauritania",                     native: "موريتانيا",                         flag: "🇲🇷", tz: "Africa/Nouakchott" },
        { name: "Mauritius",                      native: "Mauritius",                         flag: "🇲🇺", tz: "Indian/Mauritius" },
        { name: "Mexico",                         native: "México",                            flag: "🇲🇽", tz: "America/Mexico_City" },
        { name: "Micronesia",                     native: "Micronesia",                        flag: "🇫🇲", tz: "Pacific/Pohnpei" },
        { name: "Moldova",                        native: "Moldova",                           flag: "🇲🇩", tz: "Europe/Chisinau" },
        { name: "Monaco",                         native: "Monaco",                            flag: "🇲🇨", tz: "Europe/Monaco" },
        { name: "Mongolia",                       native: "Монгол",                            flag: "🇲🇳", tz: "Asia/Ulaanbaatar" },
        { name: "Montenegro",                     native: "Crna Gora",                         flag: "🇲🇪", tz: "Europe/Podgorica" },
        { name: "Morocco",                        native: "المغرب",                            flag: "🇲🇦", tz: "Africa/Casablanca" },
        { name: "Mozambique",                     native: "Moçambique",                        flag: "🇲🇿", tz: "Africa/Maputo" },
        { name: "Myanmar",                        native: "မြန်မာ",                            flag: "🇲🇲", tz: "Asia/Yangon" },
        { name: "Namibia",                        native: "Namibia",                           flag: "🇳🇦", tz: "Africa/Windhoek" },
        { name: "Nauru",                          native: "Nauru",                             flag: "🇳🇷", tz: "Pacific/Nauru" },
        { name: "Nepal",                          native: "नेपाल",                             flag: "🇳🇵", tz: "Asia/Kathmandu" },
        { name: "Netherlands",                    native: "Nederland",                         flag: "🇳🇱", tz: "Europe/Amsterdam" },
        { name: "New Zealand",                    native: "Aotearoa",                          flag: "🇳🇿", tz: "Pacific/Auckland" },
        { name: "Nicaragua",                      native: "Nicaragua",                         flag: "🇳🇮", tz: "America/Managua" },
        { name: "Niger",                          native: "Niger",                             flag: "🇳🇪", tz: "Africa/Niamey" },
        { name: "Nigeria",                        native: "Nigeria",                           flag: "🇳🇬", tz: "Africa/Lagos" },
        { name: "North Macedonia",                native: "Северна Македонија",                flag: "🇲🇰", tz: "Europe/Skopje" },
        { name: "Norway",                         native: "Norge",                             flag: "🇳🇴", tz: "Europe/Oslo" },
        { name: "Oman",                           native: "عمان",                              flag: "🇴🇲", tz: "Asia/Muscat" },
        { name: "Pakistan",                       native: "پاکستان",                           flag: "🇵🇰", tz: "Asia/Karachi" },
        { name: "Palau",                          native: "Belau",                             flag: "🇵🇼", tz: "Pacific/Palau" },
        { name: "Panama",                         native: "Panamá",                            flag: "🇵🇦", tz: "America/Panama" },
        { name: "Papua New Guinea",               native: "Papua Niugini",                     flag: "🇵🇬", tz: "Pacific/Port_Moresby" },
        { name: "Paraguay",                       native: "Paraguay",                          flag: "🇵🇾", tz: "America/Asuncion" },
        { name: "Peru",                           native: "Perú",                              flag: "🇵🇪", tz: "America/Lima" },
        { name: "Philippines",                    native: "Pilipinas",                         flag: "🇵🇭", tz: "Asia/Manila" },
        { name: "Poland",                         native: "Polska",                            flag: "🇵🇱", tz: "Europe/Warsaw" },
        { name: "Portugal",                       native: "Portugal",                          flag: "🇵🇹", tz: "Europe/Lisbon" },
        { name: "Qatar",                          native: "قطر",                               flag: "🇶🇦", tz: "Asia/Qatar" },
        { name: "Romania",                        native: "România",                           flag: "🇷🇴", tz: "Europe/Bucharest" },
        { name: "Russia",                         native: "Россия",                            flag: "🇷🇺", tz: "Europe/Moscow" },
        { name: "Rwanda",                         native: "Rwanda",                            flag: "🇷🇼", tz: "Africa/Kigali" },
        { name: "Saint Kitts and Nevis",          native: "Saint Kitts and Nevis",             flag: "🇰🇳", tz: "America/St_Kitts" },
        { name: "Saint Lucia",                    native: "Saint Lucia",                       flag: "🇱🇨", tz: "America/St_Lucia" },
        { name: "Saint Vincent and the Grenadines", native: "Saint Vincent",                  flag: "🇻🇨", tz: "America/St_Vincent" },
        { name: "Samoa",                          native: "Samoa",                             flag: "🇼🇸", tz: "Pacific/Apia" },
        { name: "San Marino",                     native: "San Marino",                        flag: "🇸🇲", tz: "Europe/San_Marino" },
        { name: "Sao Tome and Principe",          native: "São Tomé e Príncipe",               flag: "🇸🇹", tz: "Africa/Sao_Tome" },
        { name: "Saudi Arabia",                   native: "المملكة العربية السعودية",           flag: "🇸🇦", tz: "Asia/Riyadh" },
        { name: "Senegal",                        native: "Sénégal",                           flag: "🇸🇳", tz: "Africa/Dakar" },
        { name: "Serbia",                         native: "Србија",                            flag: "🇷🇸", tz: "Europe/Belgrade" },
        { name: "Seychelles",                     native: "Seychelles",                        flag: "🇸🇨", tz: "Indian/Mahe" },
        { name: "Sierra Leone",                   native: "Sierra Leone",                      flag: "🇸🇱", tz: "Africa/Freetown" },
        { name: "Singapore",                      native: "Singapore",                         flag: "🇸🇬", tz: "Asia/Singapore" },
        { name: "Slovakia",                       native: "Slovensko",                         flag: "🇸🇰", tz: "Europe/Bratislava" },
        { name: "Slovenia",                       native: "Slovenija",                         flag: "🇸🇮", tz: "Europe/Ljubljana" },
        { name: "Solomon Islands",                native: "Solomon Islands",                   flag: "🇸🇧", tz: "Pacific/Guadalcanal" },
        { name: "Somalia",                        native: "Soomaaliya",                        flag: "🇸🇴", tz: "Asia/Mogadishu" },
        { name: "South Africa",                   native: "South Africa",                      flag: "🇿🇦", tz: "Africa/Johannesburg" },
        { name: "South Sudan",                    native: "South Sudan",                       flag: "🇸🇸", tz: "Africa/Juba" },
        { name: "Spain",                          native: "España",                            flag: "🇪🇸", tz: "Europe/Madrid" },
        { name: "Sri Lanka",                      native: "ශ්‍රී ලංකාව",                        flag: "🇱🇰", tz: "Asia/Colombo" },
        { name: "Sudan",                          native: "السودان",                           flag: "🇸🇩", tz: "Africa/Khartoum" },
        { name: "Suriname",                       native: "Suriname",                          flag: "🇸🇷", tz: "America/Paramaribo" },
        { name: "Sweden",                         native: "Sverige",                           flag: "🇸🇪", tz: "Europe/Stockholm" },
        { name: "Switzerland",                    native: "Schweiz",                           flag: "🇨🇭", tz: "Europe/Zurich" },
        { name: "Syria",                          native: "سوريا",                             flag: "🇸🇾", tz: "Asia/Damascus" },
        { name: "Taiwan",                         native: "臺灣",                               flag: "🇹🇼", tz: "Asia/Taipei" },
        { name: "Tajikistan",                     native: "Тоҷикистон",                        flag: "🇹🇯", tz: "Asia/Dushanbe" },
        { name: "Tanzania",                       native: "Tanzania",                          flag: "🇹🇿", tz: "Africa/Dar_es_Salaam" },
        { name: "Thailand",                       native: "ประเทศไทย",                          flag: "🇹🇭", tz: "Asia/Bangkok" },
        { name: "Timor-Leste",                    native: "Timor-Leste",                       flag: "🇹🇱", tz: "Asia/Dili" },
        { name: "Togo",                           native: "Togo",                              flag: "🇹🇬", tz: "Africa/Lome" },
        { name: "Tonga",                          native: "Tonga",                             flag: "🇹🇴", tz: "Pacific/Tongatapu" },
        { name: "Trinidad and Tobago",            native: "Trinidad and Tobago",               flag: "🇹🇹", tz: "America/Port_of_Spain" },
        { name: "Tunisia",                        native: "تونس",                              flag: "🇹🇳", tz: "Africa/Tunis" },
        { name: "Turkey",                         native: "Türkiye",                           flag: "🇹🇷", tz: "Europe/Istanbul" },
        { name: "Turkmenistan",                   native: "Türkmenistan",                      flag: "🇹🇲", tz: "Asia/Ashgabat" },
        { name: "Tuvalu",                         native: "Tuvalu",                            flag: "🇹🇻", tz: "Pacific/Funafuti" },
        { name: "Uganda",                         native: "Uganda",                            flag: "🇺🇬", tz: "Africa/Kampala" },
        { name: "Ukraine",                        native: "Україна",                           flag: "🇺🇦", tz: "Europe/Kiev" },
        { name: "United Arab Emirates",           native: "الإمارات",                          flag: "🇦🇪", tz: "Asia/Dubai" },
        { name: "United Kingdom",                 native: "United Kingdom",                    flag: "🇬🇧", tz: "Europe/London" },
        { name: "United States",                  native: "United States",                     flag: "🇺🇸", tz: "America/New_York" },
        { name: "Uruguay",                        native: "Uruguay",                           flag: "🇺🇾", tz: "America/Montevideo" },
        { name: "Uzbekistan",                     native: "Oʻzbekiston",                       flag: "🇺🇿", tz: "Asia/Tashkent" },
        { name: "Vanuatu",                        native: "Vanuatu",                           flag: "🇻🇺", tz: "Pacific/Efate" },
        { name: "Vatican City",                   native: "Vaticano",                          flag: "🇻🇦", tz: "Europe/Vatican" },
        { name: "Venezuela",                      native: "Venezuela",                         flag: "🇻🇪", tz: "America/Caracas" },
        { name: "Vietnam",                        native: "Việt Nam",                          flag: "🇻🇳", tz: "Asia/Ho_Chi_Minh" },
        { name: "Yemen",                          native: "اليمن",                             flag: "🇾🇪", tz: "Asia/Aden" },
        { name: "Zambia",                         native: "Zambia",                            flag: "🇿🇲", tz: "Africa/Lusaka" },
        { name: "Zimbabwe",                       native: "Zimbabwe",                          flag: "🇿🇼", tz: "Africa/Harare" }
    ];

    const selectEl = document.getElementById("kmLangSelect");
    const timeEl   = document.getElementById("kmClockTime");

    // បញ្ឈប់ប្រសិនបើ element មិនមាន
    if (!selectEl || !timeEl) return;

    // ស្វែងរក timezone របស់ browser ដើម្បីជ្រើសប្រទេសសមស្រប
    const userTz       = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const defaultIndex = countries.findIndex(c => c.tz === userTz);

    // បំពេញ <select> ជាមួយប្រទេសទាំងអស់
    selectEl.innerHTML = "";
    countries.forEach(function (c, index) {
        const opt  = document.createElement("option");
        opt.value  = index;
        // ទម្រង់: 🇰🇭 កម្ពុជា (Cambodia)
        opt.text   = c.flag + " " + c.native + " (" + c.name + ")";
        selectEl.appendChild(opt);
    });

    // ជ្រើស​ប្រទេស​ស្រប​ timezone browser (ប្រសិន​បើ​រក​ឃើញ)
    selectEl.selectedIndex = defaultIndex >= 0 ? defaultIndex : 0;

    // ទទួលប្រទេសសកម្មចេញពី select
    function getSelectedCountry() {
        return countries[parseInt(selectEl.value, 10)];
    }

    // អាប់ដេតម៉ោងតាមប្រទេសដែលបានជ្រើស
    function updateTime() {
        const country = getSelectedCountry();
        try {
            const formatter = new Intl.DateTimeFormat("en-US", {
                timeZone: country.tz,
                hour:     "2-digit",
                minute:   "2-digit",
                second:   "2-digit",
                hour12:   true
            });
            timeEl.textContent = formatter.format(new Date());
        } catch (e) {
            timeEl.textContent = "N/A";
        }
    }

    // ឲ្យម៉ោងដើររាល់ ១ វិនាទីម្តង
    let intervalId = setInterval(updateTime, 1000);

    selectEl.addEventListener("change", function () {
        // ហៅ updateTime ភ្លាមៗនៅពេលផ្លាស់ប្ដូរ​ប្រទេស
        updateTime();
    });

    // បង្ហាញម៉ោងភ្លាមៗ​ពេល​ load ទំព័រ
    updateTime();
});
