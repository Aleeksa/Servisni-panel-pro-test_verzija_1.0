# ServisPanel Pro — poslovni servisni sistem

ServisPanel Pro je gotova web aplikacija za firme koje žele pregled radnih naloga, klijenata, rokova, zaduženja i naplate na jednom mestu.

## Šta sistem rešava

- evidencija servisnih i tehničkih naloga
- klijenti, kontakti i zadužene osobe
- statusi: novo, u radu, završeno
- prioriteti: nizak, srednji, hitno
- rokovi i prikaz naloga koji kasne
- naplata: nije plaćeno, delimično, plaćeno
- izveštaji po statusu, kategoriji i klijentu
- CSV izvoz i štampa
- zaštićena admin prijava

## Pokretanje lokalno

1. Instaliraj zavisnosti:

```bash
npm install
npm run install:all
```

2. Kopiraj podešavanja:

```bash
copy server\.env.example server\.env
```

3. U `server/.env` promeni admin nalog:

```env
ADMIN_EMAIL=admin@firma.com
ADMIN_PASSWORD=promeni-ovu-lozinku
SESSION_SECRET=change-this-long-random-secret
```

4. Pokreni razvojno:

```bash
npm run dev
```

Otvori:

```txt
http://localhost:5173
```

## Produkcija / hosting

Za produkcioni rad:

```bash
npm run build
npm start
```

Aplikacija se tada otvara na:

```txt
http://localhost:4000
```

Za hosting koristi:

**Build command:**

```bash
npm install && npm run install:all && npm run build
```

**Start command:**

```bash
npm start
```

**Port:**

```txt
4000
```

## Napomena za prodaju

U interfejsu su uklonjeni tehnički nazivi. Klijent vidi poslovni servisni sistem, ne razvojni stack. Ako aplikaciju prodaješ firmi, pre predaje promeni:

- naziv firme u prezentaciji/ponudi
- admin email i lozinku
- boje ili logo ako klijent traži
- uslove korišćenja i dogovor oko održavanja

Za ozbiljan online rad sa više korisnika i većim brojem naloga preporuka je da se kasnije podaci prebace na PostgreSQL bazu.
