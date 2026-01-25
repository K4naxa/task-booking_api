# 1. Tehdyt oletukset ja suunnittelupäätökset

Koska tehtävänanto jätti joitakin yksityiskohtia avoimeksi, tein seuraavat oletukset ja suunnittelupäätökset projektin rajaamiseksi:

### Autentikaatio ja käyttäjätunnistaminen

- **Oletus:** Tehtävänannossa puhuttiin "Käyttäjistä", joten oletuksena on, että käyttäjät pystyisivät hallitsemaan vain omia varauksiaan. Varsinainen autentikaatiojärjestelmä tuntui kuitenkin olevan pyydetyn "yksinkertaisuuden" ulkopuolella.
- **Ratkaisu:** Toteutin yksinkertaistetun käyttäjätunnistuksen `userId`-merkkijonolla, joka välitetään pyynnöissä. Tämä simuloi autentikoitua käyttäjää ja mahdollistaa vain omien varausten hallinnan ilman auth-toteutusta.

### Aika-granulariteetti

- **Oletus:** Huonevarausjärjestelmissä varaukset tehdään tyypillisesti tasavälisin intervallein, ei sekuntikohtaisesti.
- **Ratkaisu:** Varausjärjestelmä käyttää 10 minuutin intervalleja parantaakseen käyttäjäkokemusta ja selkeyttä. Endpoint hylkää pyynnön, jos se sisältää väärän muotoisen aikaformaatin tai ei osu intervalliin.

### Huoneiden määrä

- **Oletus:** Oikeassa toimintaympäristössä huoneiden määrä on rajallinen ja ennalta määritelty.
- **Ratkaisu:** Järjestelmään on esitäytetty (seeded) 10 huonetta. Huoneille ei ole toteutettu CRUD-toiminnallisuutta, sillä oletuksella, että tämä oli harjoitteen vaatimusten ulkopuolella.

### Varausten luonti

- **Oletus:** Toteutuksessa oletetaan, että käyttäjä valitsee ensin haluamansa huoneen ja sen jälkeen sopivan ajankohdan. Tästä syystä varauspyynnössä edellytetään huoneen tunnistetta (roomId).

### Varausten peruutus vs. poisto

- **Oletus:** Varaushistorian säilyttäminen on oleellista oikeassa toimintaympäristössä, eikä tietoa tule hävittää kokonaan.
- **Ratkaisu:** Varauksen "Peruutus" toteutetaan pehmeänä poistona (soft delete), jossa varauksen `status` muutetaan `CANCELLED`-tilaan ja `cancelledAt`-aikaleima asetetaan. Peruutetut varaukset vapauttavat aikavälin uusille varauksille.

### Varausten tarkastelu

- **Oletus:** Tehtävänannossa vaadittiin vain "tietyn huoneen varaukset", mutta käyttäjän omien varausten katselu on yleinen ja tärkeä käyttötapaus.
- **Ratkaisu:** Toteutettu useita katselu-endpointteja kattavuuden vuoksi:
  - `GET /bookings/user/:userId` – Käyttäjän omat varaukset
  - `GET /rooms/:roomId/bookings` – Huoneen kaikki varaukset
  - `GET /rooms/:roomId/bookings/confirmed` – Huoneen vahvistetut varaukset
  - `GET /rooms/:roomId/bookings/cancelled` – Huoneen peruutetut varaukset

### Aikavyöhykkeet

- **Oletus:** Järjestelmä on mahdollisesti globaali, ja aikavyöhykkeiden hallinnan tulee olla yhdenmukaista.
- **Ratkaisu:** Kaikki ajat käsitellään ja tallennetaan UTC-muodossa.

### Kontittaminen (Docker)

- **Oletus:** Vaikka tehtävänanto ei erikseen vaatinut Dockeria, oletin harjoituksen simuloivan todellista asiakasprojektia.
- **Ratkaisu:** Toteutin `Dockerfile`- ja `docker-compose.yml`-konfiguraatiot. Palvelu voidaan käynnistää yhdellä komennolla (`docker compose up -d`), mikä helpottaa merkittävästi integraatiota ja testausta.

### Samanaikaisuuden hallinta (Concurrency)

- **Ongelma:** SQLite + Prisma -yhdistelmä ei tarjoa tehokasta rivitason lukitusta, mikä mahdollistaa ns. _race condition_ bugin samanaikaisissa varauspyynnöissä.
- **Ratkaisu:** Sovellustasolla toimiva mutex (`async-mutex`), joka lukitsee varausprosessin huonekohtaisesti. Tämä imitoi tietokannan sarjallistamislogiikkaa ja estää päällekkäiset varaukset.

---

# 2. Tekoälyn analysointi

### Mitä tekoäly teki hyvin

- Seurasi "SUMMARIZE → LIST → ASK → WAIT" -prosessia ja kysyi selventäviä kysymyksiä ennen koodaamista.
- Säästi huomattavasti aikaa boilerplate-koodin ja testien luonnissa.
- Tuki ISO 8601 -aikamuotoa ja 10 minuutin granulariteettia oikein. Omaksu liiketoimintasäännöt nopeasti.
- Loi Prisma-skeeman ja relaatiot oikein. Käytti oikeita HTTP-statuskoodeja (400, 404, 409).

### Mitä tekoäly teki huonosti

- Päästi parametreja läpi validoimatta niitä ensin, vaikka tämä oli erikseen kielletty ("Never trust user input"). Jätti myös noudattamatta DRY-periaatetta validoinneissa.
- Muutti testimetodeja antamaan positiivisia tuloksia sen sijaan, että olisi korjannut itse koodissa olleen ongelman (erityisesti race condition -tilanteissa).
- Käytti liian monimutkaisia tyyppejä (esim. `Prisma.BookingGetPayload<...>`), kun yksinkertaisempi `Booking`-tyyppi olisi riittänyt.
- Toteutti monimutkaisia toimintoja manuaalisesti sen sijaan, että olisi hyödyntänyt olemassa olevia, tai promptissa määriteltyjä kirjastoja.
- **Tietokantaosaaminen:**
  - Ei huomannut race condition -ongelmaa eikä käyttänyt transaktioita oma-aloitteisesti.
  - Ei luonut indeksejä useasti käytetyille kyselyille.
  - Ei seurannut tietokannasta indeksoitujen arvojen järjestystä.
- Poisti yllättäen tärkeitä tiedostoja (esim. `seed.ts`, `bookings.controller.spec.ts`).

---

# 3. Tärkeimmät itse tehdyt parannukset

### 1. Sovellustason lukitus (`async-mutex`)

Otin käyttöön `async-mutex`-kirjaston korjaamaan kriittisen **race condition** bugin.

- **Syy:** SQLite ei tue luotettavaa rivitason lukitusta (row-level locking) samalla tavalla kuin Postgres. Ilman mutexia kaksi samanaikaista pyyntöä saattoi varata saman huoneen samalle ajalle, vaikka koodissa oli päällekkäisyystarkistus.
- **Toteutus:** Varauksen luonti lukitaan huonekohtaisella avaimella (`room:{id}`). Tämä varmistaa, että yhden huoneen varaukset käsitellään yksi kerrallaan, mutta eri huoneiden varaukset voivat edetä rinnakkain.

### 2. Validointilogiikan eriytys (`booking-validation.service.ts`)

Siirsin kaiken varauksiin liittyvän validointilogiikan omaan erilliseen service-tiedostoonsa.
**Syy:** Parantaa koodin luettavuutta ja noudattaa **Single Responsibility** -periaatetta. Controller ja varsinainen `BookingService` pysyvät siisteinä, kun monimutkaiset aikasääntöjen tarkistukset ovat omassa moduulissaan. Tämä helpottaa myös sääntöjen yksikkötestausta.

### 3. Tietokantatransaktiot (`prisma.transaction`)

Käärin varausten luonnit ja muokkaukset Prisman transaktioihin.
**Syy:** Turvaa tietokannan eheyden (data integrity). Jos jokin osa operaatiosta epäonnistuu, mitään muutoksia ei tallenneta.

### 4. Tyyppiturvallisuuden parantaminen

Lisäsin eksplisiittiset paluutyypit (return types) kaikkiin funktioihin ja metodeihin.
**Syy:** Selkeyttää rajapintoja ja estää tahattomat tyyppivirheet. Koodin ymmärrettävyys parani huomattavasti, kun funktion signatuurista näkee heti, mitä se palauttaa.

### 5. DRY-periaate ja DTO:t

Loin `UserIdDto`:n ja `UserIdValidationPipe`:n.
**Syy:** Poistin toisteisen koodin (DRY). Samaa validointilogiikkaa `userId`-kentälle käytetään useassa eri endpointissa, joten sen keskittäminen yhteen paikkaan helpottaa ylläpitoa huomattavasti.

### 6. Tietokannan optimointi

Lisäsin tietokantaindeksit usein käytetyille hakukentille ja hyödynsin komposiitti-avaimia.
**Indeksit:** Parantavat kyselyiden suorituskykyä tietokannan kasvaessa.
**Unique Composite Key (`id_userId`):** Käytetty varauksen peruutuksessa varmistamaan, että käyttäjä voi peruuttaa vain omat varauksensa yhdellä atomisella kyselyllä, sekä pitäen koodin helposti luettavana
