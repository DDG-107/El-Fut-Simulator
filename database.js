// database.js - The central repository of baseline teams and players
const gameDatabase = {
    leagues: {
        "ENG 1": {
            name: "English Premier League",
            teams: [
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
                        { name: "Sebastian Driussi", pos: "CAM", rating: 80, img: "assets/sebastiandriussi.png" },
                        { name: "K. Mbappé", pos: "ST", rating: 91, potential: 92, age: 26, value: "€157M", wage: "€610K", img: "assets/mbappe.png" },
                        { name: "Vini Jr.", pos: "ST", rating: 89, potential: 92, age: 24, value: "€141M", wage: "€320K", img: "assets/vinijr.png" }
                    ]
                },
                {
                    id: "che",
                    name: "Chelsea FC",
                    budget: 120000000,
                    players: [
                        { name: "Robert Sánchez", pos: "GK", rating: 80, img: "assets/sanchez.png" },
                        { name: "R. James", pos: "RB", rating: 82, img: "assets/james.png" },
                        { name: "L. Colwill", pos: "CB", rating: 79, img: "assets/colwill.png" },
                        { name: "W. Fofana", pos: "CB", rating: 79, img: "assets/fofana.png" },
                        { name: "M. Cucurella", pos: "LB", rating: 80, img: "assets/cucurella.png" },
                        { name: "M. Caicedo", pos: "CDM", rating: 81, img: "assets/caicedo.png" },
                        { name: "Enzo Fernández", pos: "CM", rating: 80, img: "assets/enzo.png" },
                        { name: "C. Palmer", pos: "CAM", rating: 84, img: "assets/palmer.png" },
                        { name: "N. Madueke", pos: "RW", rating: 79, img: "assets/madueke.png" },
                        { name: "J. Sancho", pos: "LW", rating: 80, img: "assets/sancho.png" },
                        { name: "N. Jackson", pos: "ST", rating: 81, img: "assets/jackson.png" }
                    ]
                },
                { id: "liv", name: "Liverpool FC", budget: 140000000, players: [] },
                { id: "ars", name: "Arsenal", budget: 130000000, players: [] }
            ]
        },
        "ESP 1": {
            name: "La Liga",
            teams: [
                { id: "bar", name: "FC Barcelona", budget: 100000000, players: [] },
                { id: "atm", name: "Atlético Madrid", budget: 80000000, players: [] }
            ]
        }
    }
};