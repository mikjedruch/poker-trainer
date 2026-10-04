# Trener pokera

Aplikacja do nauki pokera dla gracza live 6-max NLHE, blindy $1/$2, stack $200.
Działa w przeglądarce i na telefonie (można ją zainstalować jako aplikację; po pierwszym otwarciu działa offline).

## Co już działa

- **Matematyka** — 7 typów zadań: outy, equity, pot odds, call/fold, MDF, bluff, implied odds.
  Po każdej odpowiedzi wyjaśnienie z podstawionymi liczbami. Statystyki trafności;
  w trybie „Mieszane” częściej losują się typy, w których robisz więcej błędów.
- **Wygląd** — ciemny motyw (domyślny) albo jasny, talia 4-kolorowa (domyślna) albo 2-kolorowa:
  przełączniki w **Ustawieniach** na ekranie głównym. Duże karty, odpowiedzi wpisywane na dużej klawiaturze
  na dole ekranu, „Dalej” w tym samym miejscu co przycisk odpowiedzi.

## Uruchomienie lokalnie

Wymaga Node.js 20 lub nowszego.

```
npm install
npm run dev        # aplikacja na http://localhost:5173/poker-trainer/
npm test           # wszystkie testy (ok. 20 s)
npm run build      # wersja produkcyjna do katalogu dist/
npm run preview    # podgląd wersji produkcyjnej
```

Każdy push na gałąź `main` uruchamia testy i — jeśli przejdą — publikuje aplikację na GitHub Pages.
