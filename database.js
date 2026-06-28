// database.js - The central repository of baseline teams and players
const gameDatabase = {
    leagues: {
        "ENG 1": {
            name: "Premier League 25/26",
            teams: [
                {
                    id: "che",
                    name: "Chelsea FC",
                    budget: 120000000,
                    players: [
                        { name: "R. Sánchez", pos: "GK", rating: 81, img: "assets/robertsnchez.png" },
                        { name: "M. Gusto", pos: "RB", rating: 79, img: "assets/mgusto.png" },
                        { name: "W. Fofana", pos: "CB", rating: 79, img: "assets/wfofana.png" },
                        { name: "L. Colwill", pos: "CB", rating: 80, img: "assets/lcolwill.png" },
                        { name: "M. Cucurella", pos: "LB", rating: 85, img: "assets/marccucurella.png" },
                        { name: "R. James", pos: "RB", rating: 84, img: "assets/rjames.png" },
                        { name: "M. Caicedo", pos: "CDM", rating: 88, img: "assets/mcaicedo.png" },
                        { name: "C. Palmer", pos: "CAM", rating: 88, img: "assets/cpalmer.png" },
                        { name: "Pedro Neto", pos: "RM", rating: 82, img: "assets/pedroneto.png" },
                        { name: "E. Fernández", pos: "CM", rating: 85, img: "assets/efernndez.png" },
                        { name: "João Pedro", pos: "ST", rating: 82, img: "assets/joopedro.png" },                    ]
                },
                { id: "liv", name: "Liverpool FC", budget: 140000000, players: [
                        { name: "Alisson", pos: "GK", rating: 88, img: "assets/alisson.png" },
                        { name: "D. Szoboszlai", pos: "CAM", rating: 86, img: "assets/dszoboszlai.png" },
                        { name: "I. Konaté", pos: "CB", rating: 84, img: "assets/ikonat.png" },
                        { name: "V. van Dijk", pos: "CB", rating: 88, img: "assets/vvandijk.png" },
                        { name: "A. Robertson", pos: "LB", rating: 81, img: "assets/arobertson.png" },
                        { name: "R. Gravenberch", pos: "CDM", rating: 86, img: "assets/rgravenberch.png" },
                        { name: "A. Mac Allister", pos: "CM", rating: 85, img: "assets/amacallister.png" },
                        { name: "M. Salah", pos: "RM", rating: 89, img: "assets/msalah.png" },
                        { name: "C. Gakpo", pos: "LM", rating: 83, img: "assets/cgakpo.png" },
                        { name: "F. Wirtz", pos: "CAM", rating: 87, img: "assets/fwirtz.png" },
                        { name: "A. Isak", pos: "ST", rating: 87, img: "assets/aisak.png" },
                ] },
                { id: "ars", name: "Arsenal", budget: 130000000, players: [
                    { name: "D. Raya", pos: "GK", rating: 84, img: "assets/draya.png" },
                    { name: "J. Timber", pos: "RB", rating: 83, img: "assets/jtimber.png" },
                    { name: "W. Saliba", pos: "CB", rating: 88, img: "assets/wsaliba.png" },
                    { name: "Gabriel", pos: "CB", rating: 88, img: "assets/gabriel.png" },
                    { name: "R. Calafiori", pos: "LB", rating: 82, img: "assets/rcalafiori.png" },
                    { name: "M. Zubimendi", pos: "CDM", rating: 85, img: "assets/mzubimendi.png" },
                    { name: "D. Rice", pos: "CDM", rating: 87, img: "assets/drice.png" },
                    { name: "M. Ødegaard", pos: "CAM", rating: 87, img: "assets/mdegaard.png" },
                    { name: "B. Saka", pos: "RW", rating: 88, img: "assets/bsaka.png" },
                    { name: "V. Gyökeres", pos: "ST", rating: 87, img: "assets/vgykeres.png" },
                    { name: "G. Martinelli", pos: "LW", rating: 83, img: "assets/gmartinelli.png" }
                ] }, // <-- Added the missing comma right here!
                { id: "mun", name: "Manchester United", budget: 110000000, players: [
                        { name: "S. Lammens", pos: "GK", rating: 81, img: "assets/slammens.png" },
                        { name: "Diogo Dalot", pos: "RB", rating: 78, img: "assets/diogodalot.png" },
                        { name: "H. Maguire", pos: "CB", rating: 81, img: "assets/hmaguire.png" },
                        { name: "A. Heaven", pos: "CB", rating: 74, img: "assets/aheaven.png" },
                        { name: "L. Shaw", pos: "LB", rating: 79, img: "assets/lshaw.png" },
                        { name: "Casemiro", pos: "CDM", rating: 82, img: "assets/casemiro.png" },
                        { name: "K. Mainoo", pos: "CDM", rating: 79, img: "assets/kmainoo.png" },
                        { name: "Amad", pos: "RM", rating: 80, img: "assets/amad.png" },
                        { name: "Matheus Cunha", pos: "CAM", rating: 83, img: "assets/matheuscunha.png" },
                        { name: "Bruno Fernandes", pos: "CAM", rating: 88, img: "assets/brunofernandes.png" },
                        { name: "B. Mbeumo", pos: "RW", rating: 85, img: "assets/bmbeumo.png" },
                ] },
                {id: "mci", name: "Manchester City", budget: 200000000, players: []},
                {id: "tot", name: "Tottenham Hotspur", budget: 90000000, players: []},
                {id: "new", name: "Newcastle United", budget: 95000000, players: []},
                {id: "vil", name: "Aston Villa", budget: 85000000, players: []},
                {id: "bou", name: "AFC Bournemouth", budget: 75000000, players: []},
                {id: "ful", name: "Fulham FC", budget: 70000000, players: []},
                {id: "bre", name: "Brentford FC", budget: 65000000, players: []},
                {id: "whu", name: "West Ham United", budget: 60000000, players: []},
                {id: "bha", name: "Brighton & Hove Albion", budget: 55000000, players: []},
                {id: "sun", name: "Sunderland AFC", budget: 50000000, players: []},
                {id: "lee", name: "Leeds United", budget: 45000000, players: []},
                {id: "not", name: "Nottingham Forest", budget: 40000000, players: []},
                {id: "eve", name: "Everton FC", budget: 35000000, players: []},
                {id: "crystal", name: "Crystal Palace", budget: 30000000, players: []},
                {id: "bur", name: "Burnley FC", budget: 25000000, players: []},
                {id: "wol", name: "Wolverhampton Wanderers", budget: 20000000, players: []},

            ]
        },
        "ESP 1": {
            name: "La Liga 25/26",
            teams: [
                { id: "bar", name: "FC Barcelona", budget: 100000000, players: [
                        { name: "Joan García", pos: "GK", rating: 86, img: "assets/joangarca.png" },
                        { name: "J. Koundé", pos: "RB", rating: 86, img: "assets/jkound.png" },
                        { name: "Pau Cubarsí", pos: "CB", rating: 83, img: "assets/paucubars.png" },
                        { name: "Eric García", pos: "CB", rating: 83, img: "assets/ericgarca.png" },
                        { name: "João Cancelo", pos: "RB", rating: 84, img: "assets/joocancelo.png" },
                        { name: "F. de Jong", pos: "CM", rating: 87, img: "assets/fdejong.png" },
                        { name: "Pedri", pos: "CM", rating: 90, img: "assets/pedri.png" },
                        { name: "Fermín", pos: "CAM", rating: 83, img: "assets/fermn.png" },
                        { name: "Lamine Yamal", pos: "RW", rating: 89, img: "assets/lamineyamal.png" },
                        { name: "Ferran Torres", pos: "ST", rating: 84, img: "assets/ferrantorres.png" },
                        { name: "Raphinha", pos: "LW", rating: 89, img: "assets/raphinha.png" },
                ] },
                { id: "atm", name: "Atlético Madrid", budget: 80000000, players: [
                        { name: "J. Oblak", pos: "GK", rating: 88, img: "assets/joblak.png" },
                        { name: "Marcos Llorente", pos: "RB", rating: 85, img: "assets/marcosllorente.png" },
                        { name: "Pubill", pos: "CB", rating: 80, img: "assets/pubill.png" },
                        { name: "D. Hancko", pos: "LB", rating: 83, img: "assets/dhancko.png" },
                        { name: "M. Ruggeri", pos: "LB", rating: 78, img: "assets/mruggeri.png" },
                        { name: "Giuliano", pos: "RM", rating: 82, img: "assets/giuliano.png" },
                        { name: "Pablo Barrios", pos: "CM", rating: 83, img: "assets/pablobarrios.png" },
                        { name: "Koke", pos: "CM", rating: 81, img: "assets/koke.png" },
                        { name: "A. Lookman", pos: "ST", rating: 83, img: "assets/alookman.png" },
                        { name: "A. Griezmann", pos: "ST", rating: 84, img: "assets/agriezmann.png" },
                        { name: "J. Alvarez", pos: "ST", rating: 86, img: "assets/jalvarez.png" },
                ] },
                {
                    id: "rmd",
                    name: "Real Madrid",
                    budget: 150000000,
                    players: [
                        { name: "T. Courtois", pos: "GK", rating: 90, potential: 90, age: 33, value: "€39M", wage: "€240K", img: "assets/courtois.png" },
                        { name: "T. Alexander-Arnold", pos: "RB", rating: 85, potential: 86, age: 26, value: "€58M", wage: "€230K", img: "assets/arnold.png" },
                        { name: "A. Rüdiger", pos: "CB", rating: 84, potential: 84, age: 32, value: "€27.5M", wage: "€220K", img: "assets/rudiger.png" },
                        { name: "D. Huijsen", pos: "CB", rating: 81, potential: 88, age: 20, value: "€47.5M", wage: "€120K", img: "assets/huijsen.png" },
                        { name: "Álvaro Carreras", pos: "LB", rating: 81, potential: 87, age: 22, value: "€38.5M", wage: "€140K", img: "assets/carreras.png" },
                        { name: "A. Tchouaméni", pos: "CDM", rating: 84, potential: 87, age: 25, value: "€50.5M", wage: "€200K", img: "assets/tchouameni.png" },
                        { name: "F. Valverde", pos: "CM", rating: 89, potential: 90, age: 26, value: "€120.5M", wage: "€340K", img: "assets/valverde.png" },
                        { name: "A. Güler", pos: "CM", rating: 83, potential: 89, age: 20, value: "€56.5M", wage: "€150K", img: "assets/guler.png" },
                        { name: "J. Bellingham", pos: "CAM", rating: 80, img: "assets/bellingham.png" },
                        { name: "K. Mbappé", pos: "ST", rating: 91, potential: 92, age: 26, value: "€157M", wage: "€610K", img: "assets/mbappe.png" },
                        { name: "Vini Jr.", pos: "ST", rating: 89, potential: 92, age: 24, value: "€141M", wage: "€320K", img: "assets/vinijr.png" }
                    ]
                }
            ]
        }
    }
};