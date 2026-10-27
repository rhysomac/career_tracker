const COUNTRY_CODES = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW XK";
const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
const flagForCode = code => [...code.toUpperCase()].map(letter => String.fromCodePoint(letter.charCodeAt(0) + 127397)).join("");
export const NATIONS = COUNTRY_CODES.split(" ").map(code => ({
  code,
  name: displayNames.of(code) || code,
  flag: flagForCode(code),
})).sort((a, b) => a.name.localeCompare(b.name));

const nationByCode = new Map(NATIONS.map(nation => [nation.code, nation]));
const nationByName = new Map(NATIONS.map(nation => [nation.name.toLowerCase(), nation.code]));

export function nationCode(value) {
  const text = String(value ?? "").trim();
  if (nationByCode.has(text.toUpperCase())) return text.toUpperCase();
  const flags = [...text].filter(char => char.codePointAt(0) >= 127462 && char.codePointAt(0) <= 127487);
  if (flags.length === 2) {
    const code = flags.map(char => String.fromCodePoint(char.codePointAt(0) - 127397)).join("");
    if (nationByCode.has(code)) return code;
  }
  return nationByName.get(text.toLowerCase()) || "";
}

export function nationFlag(value) {
  const code = nationCode(value);
  return code ? nationByCode.get(code).flag : String(value ?? "").trim();
}

export function nationName(value) {
  const code = nationCode(value);
  return code ? nationByCode.get(code).name : String(value ?? "").trim();
}
