#Solitaire Kabal Spill
#render url https://mm-207-x3og.onrender.com
##Prosjektoversikt
Et nettbasert Solitaire-spill med full persistens, PWA-støtte og moderne web-teknologier.
#Teknologier

Frontend: HTML, CSS, JavaScript
Backend: Node.js, Express.js
Database: PostgreSQL (Render)
Øktadministrasjon: Express-session
Distribusjon: Render

#Funksjoner

Komplett Solitaire-spillimplementasjon
Progressive Web App (PWA)
Lagre og laste spilltilstander
Økstbasert brukerbehandling
Sanntids spilltilstandssporing


API-endepunkter
Spilladministrasjon

POST /api/solitaire/games: Opprett nytt spill
GET /api/solitaire/games/{gameId}: Hent spilltilstand

Spillhandlinger

POST /api/solitaire/games/{gameId}/draw: Trekk et kort
POST /api/solitaire/games/{gameId}/board-to-board/{fromIndex}/{toIndex}/{cardIndex}: Flytt kort mellom spillbrett

Lagre/Laste

POST /api/solitaire/games/{gameId}/save: Lagre nåværende spill
GET /api/solitaire/saves: List opp lagrede spill
GET /api/solitaire/saves/{saveName}/load: Last et bestemt lagret spill