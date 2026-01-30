import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@vercel/postgres';

// Artist names from Shopify catalog
const SHOPIFY_ARTISTS = [
  'Agostinelli', 'Eidrigevicius Stasys', 'Emile André Schefer', 'Huseyin', 'Sherman Foote Denton',
  'A. Berezitsky', 'A. Blochlinger', 'A. De Loof', 'A. Franquet', 'A. Freppel', 'A. Galland',
  'A. Molusson', 'A. Ober', 'A. Peris', 'A. Péris', 'A. Petruccelli', 'A. Vallee', 'A. Van Clasteren',
  'A.M. Cassandre', 'Abeking', 'Ace Venturas', 'Adolf Kronengold', 'Adriaan Willem Driessen',
  'Al Hirschfeld', 'Alain Weine', 'Albert Brenet', 'Albert Guillaume', 'Albert Hubell',
  'Albert W. Barbelle', 'Alberti', 'Alberto Vargas', 'Alekos Fassianos', 'Alex Lukens',
  'Alexander Calder', 'Alfonso Dominguez', 'Alfred Choubrac', 'Allard', 'Allen Saalburg',
  'Almir Mavignier', 'Alton Kelley', 'Andre Galland', 'Andre Lhote', 'Andre Masson', 'André Masson',
  'Andrew Fare', 'Andry-Farcy', 'Andrzej Krajewski', 'Andrzej Pągowski', 'Andy Warhol', 'Anglada',
  'Anne Burgess', 'Antoni Tapies', 'Antonio Clave', 'Armando Gonzáles', 'Armin Vogt', 'Arte',
  'Arthur Crouch', 'Arthur Getz', 'Austin Briggs', 'Autoli Candela', 'B.H. Warren', 'Bahr',
  'Bailestar', 'Balz Bacchi', 'Banhan Thaitanaboon', 'Bardineau', 'Baron Cuvier', 'Bazzi',
  'Bernard Gillam', 'Bernard Villemot', 'Bertram/Volkart', 'Bertrandt', 'Betto Lotti', 'Bill Graham',
  'Bill Randall', 'Björne', 'Blechman', 'Bob Fried', 'Bocianowski', 'Bonnie MacLean', 'boo', 'Booth',
  'Bors Ferenec', 'Branca', 'Brett Davidson', 'BRUNSWIC', 'Brym Honhauer', 'Burton Morris',
  'Butenko Pinxit', 'C. Belinsky', 'C. Brunswic', 'C. Herouard', 'C. Martin', 'C.E.M.', 'Camet',
  'Camille Hilaire', 'Cappiello', 'Carl Kunst', 'Carl Roesch', 'Carl Roescj', 'Carlo Dradi', 'CEM',
  'Charles Addams', 'Charles Burki', 'Charles D\'Orbigny', 'Charles Leandre', 'Charles Loupot',
  'Charles M. Schulz', 'Charles Tichon', 'Charles Verneau', 'Charles Yray', 'Cheri Herouard',
  'Chéri Hérouard', 'Chozzani', 'Chuck Slack', 'Claes Oldenburg', 'Claude Kuhn-Klein', 'Claude Venard',
  'Constant Duval', 'Constantin Alajalov', 'Constantin Belinsky', 'Constantin Terechkovitch', 'Courome',
  'd\'apres G. Favre', 'd\'apres Juan Gris', 'd\'apres Toulouse-Lautrec', 'Dana W. Johnson', 'Danka',
  'David Byrd', 'David Hockney', 'David Klein', 'David Lance Goines', 'Davis', 'De Rycker', 'Delval',
  'Dennis Wheeler', 'Dexter Brown', 'Dickran Palulian', 'Dimas', 'Don Herold', 'Don Weller', 'Dorck',
  'Dorfi', 'Dubois', 'E. Bellini', 'E. Cabedo Torrent', 'E. Koch', 'E. Loraine', 'E. Moliné Montis',
  'Ed. Courchinoux', 'Edgar Derouet, Charles Lesacq', 'Edna Eicke', 'Édouard', 'Edouard Bollerat',
  'Edward Penfield', 'Elisabeth Orton Jones', 'Emil Rudolph Weiss', 'Emile Clouet', 'Emile Hugon',
  'Eric Kellenberger', 'Erik Nitsche', 'Ernest Hamlin Baker', 'Ernesto Cabral', 'Ernesto Garcia Cabral',
  'Ernesto Guasp', 'Ernst Friedrich van Husen', 'Eugene Mihaesco', 'Eugene Mihasco', 'Eugene Oge',
  'Eugene Patkevitch', 'Evelyne Noviant', 'Ewa Gargulinska', 'F. Agostini', 'F. Cabedo Torrent',
  'F. de Prado', 'F. Mellado', 'F.V. Carpenter', 'Fabien Fabiane', 'Fabien Fabiano', 'Falcucci',
  'Farve', 'Fernand Fernel', 'Fernand Leger', 'Fernand Nadal Roquin', 'Fernando Botero',
  'Filippo Buonanni', 'Floherty Jr.', 'Fore', 'Fortunato Depero', 'Francis Bernard',
  'Francisco Rivero Gil', 'Francisco Tamagno', 'Franciszek Starowieyski', 'Franciszek Starowiezski',
  'Franco Barberis', 'Frank H. Desch', 'Frank McIntosh', 'Frans Mettes', 'Frederick Opper', 'Friedl',
  'Fritz Jebray', 'Fritz Winter', 'G. Aberg', 'G. Hotop', 'G. Justh', 'G.. Kamke', 'Gabor',
  'Gabriel Humair', 'Garn', 'Garrett Price', 'Gaston Gorde', 'Gelotte', 'Gene Hoffman', 'Gene Pressler',
  'Geo Conde', 'Geo Yrrab', 'George Brettingham Sowerby', 'George D\'Apres', 'George de Zayas',
  'George Giusti', 'George Petty', 'George Vantongerloo', 'Georges Dola', 'Georges Farve',
  'Georges Favre', 'Georges Goursat', 'Georges Mathieu', 'Georges Spiro', 'Giorgio Muggiani',
  'Giovanni Mingozzi', 'Giuseppe Magagnoli (Maga)', 'Gluyas Williams', 'Greta Vaahtera',
  'Gretchen Dow Simpson', 'Gretchen Von Simpson', 'Günther Kieser', 'Gus Bofa', 'Guth',
  'Gyorgy Kolozsvary', 'Gyozo Szilas', 'H.J. Soulen', 'Ha-Ga', 'Hannah Bodnar', 'Hans Fabigan',
  'Harry Cimino', 'Harvey Chan', 'Heidi', 'Heikki Ahtiala', 'Helen Hokinson', 'Heler', 'Henri Avalot',
  'Henri Avelot', 'Henri LeMonnier', 'Henri Monnier', 'Henry Flag', 'Henry Gerbault', 'Henry Martin',
  'Henryk Tomaszewski', 'Herbert Leupin', 'Herbert Matter', 'Herouard', 'Herric', 'Herve Morvan',
  'Hiromitsu Nakazawa', 'Horton/Sandiford', 'Huguet', 'Hund', 'Hurst', 'Iboudiouf', 'Igor Zakowski',
  'Ilonka Karasz', 'Irab', 'Iris Van Rybach', 'Istvan Orosz', 'J. Bordas', 'J. Carazo', 'J. Chassing',
  'J. Cros Estrems', 'J. Jacquelin', 'J. Lem', 'J. Reus', 'J.F. Kernan', 'J.M. Lafon', 'Jacek Neugebauer',
  'Jack Coggins', 'Jack Davis', 'Jack de Rijk', 'Jack Hatfield', 'Jack Laycox', 'Jackson Pollock',
  'Jacques Auriac', 'Jacques Bellenger', 'Jacques Grognet', 'Jacques Nathan-Garamond', 'Jacques Villon',
  'Jakub Erol', 'James Montgomery Flagg', 'Jan Lenica', 'Jan Mlodozeniec', 'Jan Sawka', 'Jancunskli',
  'Janusz Oblucki', 'Janusz Starchuski', 'Javier Vilato', 'Jean Carlu', 'Jean d\'Ylen', 'Jean D\'Ylen',
  'Jean Michel Folon', 'Jean Pruniere', 'Jean Walther', 'Jean-André Chièze', 'Jean-Jacques Sempe',
  'Jean-Leon Gouweloos', 'Jean-Michel Folon', 'Jenni Oliver', 'Jerome', 'Jerzy Antczak', 'Jerzy Flisak',
  'Jerzy Skarzynski', 'Jim Blashfield', 'Jo Roux', 'Joan Miro', 'Joel Beck', 'John Berkey',
  'John Gallucci', 'John Onwy', 'Jolanta Karczewska', 'Jon Whitcomb', 'Jori Morin', 'Jose de Zamora',
  'Joseph Binder', 'Joseph Charles', 'Joseph Leon', 'Joseph Low', 'Joseph Manorino', 'Jozef Mroszczak',
  'Juan Antonio Vargas Ocampo', 'Juan Landi', 'Jules Cheret', 'Julius Gipkens', 'K. and J. Barnum',
  'Karel Appel', 'Karussell', 'Keith Haring', 'Kemper Thomas Randall', 'Kersten', 'Kidder',
  'Klaas Vegter', 'Klaus Rutters', 'Kofi Bailey', 'Koloman Moser', 'Koren', 'Krzysztoforski',
  'L. Caillaud', 'L. Conchon', 'L. Koidan', 'L. Luc-Deje', 'L. Postnikh', 'L. Rakov', 'L. S. Bush',
  'L. Tarasova', 'L.D. Valverane', 'L.H. Joutel', 'La Clercq', 'Lajos Marton', 'Landi',
  'Laura Jean Allen', 'Lawson Wood', 'Lee Conklin', 'Leo Fontan', 'León A. Hidalgo', 'Leon Astruc',
  'Leon V. Solon', 'Leonard Beaumont', 'Leonard Dove', 'Leonetto Cappiello', 'LeRoy Neiman', 'Levin',
  'Lindemann', 'Lopatina', 'Louis Charbonnier', 'Louis Morin', 'Lucien Boucher', 'Lucien Métivet',
  'Ludwig Bemelmans', 'Ludwig Hohlwein', 'Luis Vega', 'Lynch Guillotin', 'Lyonel Feininger', 'M',
  'M. Fedorov', 'Mabel Dwight', 'Maceij Hibner', 'Maciej Hibner', 'Maciej Zbikowski', 'Manorino.',
  'MARC', 'Marc Chagall', 'Marcelin Auzolle', 'Marcellus Hall', 'Marcin Mroszcza', 'Marcus',
  'Marek Mosinski', 'Mark L. Arminski', 'Marsas', 'Marszalek Grzegorz', 'Martínez de León',
  'Martin J. Treadway', 'Martin Peikert', 'Mary Petty', 'Mattheus Merian', 'Maurice Dufrene',
  'Maurice Dufrène', 'Maurice Millière', 'Max Bill', 'Meulemans', 'Mich', 'Michael D. Gilden',
  'Michael Faber', 'Michael Kanarek', 'Michael Turner', 'Michel Achard', 'Mieczysław Wasilewski',
  'Miguel Covarrubias', 'Mikke', 'Milton Bancroft', 'Milton Glaser', 'Mingozzi', 'Misti', 'Miturich',
  'Mlodozeniec', 'Moaty', 'Mose', 'Mosinski', 'Motuzka', 'Mucha Ihnatowicz', 'Munoz Bachs',
  'Murugakani', 'N. Stojanovic.', 'N. Usov', 'Nathan-Garamond', 'Nazarov', 'Neal Adams', 'Neal Bose',
  'Nemo', 'Nepomniashchii', 'Nicholas Wilton', 'Nicolitch', 'Niklaus Stoecklin', 'Niklaus Troxler',
  'Norman Rockwell', 'Not In Managed List Artist', 'O. Anton', 'o. Zaikova', 'O. Zaikova', 'O.K. Gerard',
  'O.K. Gérard', 'Ole Stockmarr', 'Olga Voronkova', 'Onesim Colavidas', 'Originario', 'Otl Aicher',
  'P. Brissaurd', 'P. Cazaux', 'P. De Pannemaeker', 'P. Diaz', 'P. Dumont', 'P. Jalier', 'P. Seignouret',
  'Pablo Picasso', 'PAL', 'Patrick Lofthouse', 'Paul Bruhwiler', 'Paul Colin', 'Paul Collomb',
  'Paul Degen', 'Paul Rand', 'Payot', 'Peter Arno', 'Peuser', 'Philippe Halsman', 'Picasso',
  'Pierre Bellenger', 'Pierre Fix-Masseau', 'Pierre Gaillardot', 'Pierre Lefevre', 'Pierre Okley',
  'Pierre Pigeot', 'R. Gorsch', 'R. M. Perot', 'R. Monge', 'R. Prejelan', 'R. Van Doren', 'Rafal Olbinski',
  'Ralph Frederick', 'Ralph Schraivogel', 'Randy Tuten', 'Raoul Auger', 'Raymond Gid', 'Raymond Savignac',
  'Rea Irvin', 'Reiner Zieger', 'Renato Casaro', 'Renau', 'René Aubert', 'Rene Ferracci', 'Rene Gruau',
  'Rene H. Pesle', 'René Leverd', 'Rene Pean', 'Rene Ravo', 'Rene Vincent', 'Restoration Artist',
  'Reynold Brown', 'Ric Haynes', 'Ricard Badia', 'Ricardo Anaya', 'Richard Amsel',
  'Richard Kuba Grzybowski', 'Richard Roth', 'Richardson Studio', 'Rick Griffin', 'Robert Angerman',
  'Robert Bonfils', 'Robert Indiana', 'Robert McGinnis', 'Robert O. Reid', 'Robert Rodriguez',
  'Robert Roquin', 'Robert Savary', 'Robert Seguin', 'Robert Vernet-Bonfort', 'Robert Weber',
  'Roberto Domingo', 'Roby Day', 'Robys', 'Roesch', 'Roger Berckmans', 'Roger David', 'Roger Duvoisin',
  'Roger Soubie', 'Roland Butler', 'Roland Topor', 'Roman Cieslewicz', 'Romvald Socha',
  'Rosmarie Tissi', 'Rosseau', 'Rougery La Blondel', 'Roxie', 'Roxie Munro', 'Roy Lichtenstein', 'Rudd',
  'Ruedi Kulling', 'Ryland John Jr. Scotford', 'Ryszard Kuba Grzbowski', 'S. Greco', 'S. Kuznetsov',
  's. Popov', 'S. Uvarov', 'S.P. Minenok', 'Salvador Dalí', 'Samuel Colville Bailie', 'Samy',
  'San Marco', 'Sascha Maurer', 'Saxn', 'Saxon', 'Schallman', 'Schell', 'SEM (Georges Goursat)',
  'Sempe', 'Sepo (Severo Pozzati)', 'Serge Poliakoff', 'Shannon Knox', 'Shart', 'Sherman Foote Dentone',
  'Simon Chaye', 'Simon Greco', 'Simon Hantai', 'Smith', 'Sobha Singh', 'Socha Romuald', 'Sogno',
  'Soneson', 'Spy', 'Stahlhut', 'Stanislaw Zamecznik', 'Stanley Mouse', 'Starchuski', 'Steig',
  'Steinberg', 'Stephane', 'Stephano', 'Stevenson', 'Studio Cros Padova', 'T. Crol Estremy', 'Tallon',
  'Terechowicz', 'The Beggarstaff Brothers', 'Thomas Geismar', 'Thomas Heine', 'Tilyjac', 'Toni',
  'Traub', 'Troxler Niklaus', 'Trubanov', 'Tsarev', 'U. Kawamura', 'Urbaniec', 'V. Mekhantiev',
  'V. Yermakov', 'Valerio Adami', 'Van Gogh', 'Van Husen Koln', 'Vanni Tealdi', 'Viano', 'VIC',
  'Vic Fair & Brian Bysouth', 'Victor Beals', 'Victor Moscoso', 'Victor Petit', 'Vittorio Fiorucci',
  'Vorona', 'W. Howard Bensel', 'W. J. Gordon', 'W. Steig', 'W.W. Clarke', 'Waldemar Swierzy',
  'Walkuski', 'Walter Buehr', 'Walter Pfeiffer', 'Walter Schnackenberg', 'Wasilewski',
  'Wassily Kandinsky', 'Weisser', 'Welch', 'WEM', 'Werner Jeker', 'Werner Klemke',
  'Werner Von Axster-Heudtlass', 'Wes Wilson', 'Wieslaw Walkuski', 'Wiesław Wałkuski', 'Wiktor Gorka',
  'Will Parker', 'Willard Frederic Elmes', 'William Auberch-Levy', 'William Cotton', 'William Mackenzie',
  'William Slattery', 'William Stout', 'Willism Mackenzie', 'Witold Gordon', 'Witold Janowski',
  'Wm Hogarth', 'Yatuka Ohashi', 'Yrau', 'Yves Brayer', 'Z. Horodcki',
];

/**
 * POST /api/migrate/seed-artists
 * Seed the artists table with data from Shopify catalog
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: string[] = [];

    // Ensure artists table exists (from managed-lists migration)
    await sql`
      CREATE TABLE IF NOT EXISTS artists (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        aliases TEXT[],
        nationality VARCHAR(100),
        birth_year INT,
        death_year INT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    results.push('Verified artists table exists');

    // Create unique index on lowercase name to prevent duplicates
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_artists_name_unique
      ON artists (LOWER(TRIM(name)))
    `;
    results.push('Created unique index on artist name');

    // Insert artists, skipping duplicates
    let inserted = 0;
    let skipped = 0;

    for (const artistName of SHOPIFY_ARTISTS) {
      const trimmedName = artistName.trim();
      if (!trimmedName || trimmedName === 'Not In Managed List Artist') {
        skipped++;
        continue;
      }

      try {
        await sql`
          INSERT INTO artists (name)
          VALUES (${trimmedName})
          ON CONFLICT ((LOWER(TRIM(name)))) DO NOTHING
        `;
        inserted++;
      } catch {
        // Skip on any error (likely duplicate)
        skipped++;
      }
    }

    results.push(`Inserted ${inserted} artists (${skipped} duplicates skipped)`);

    // Get total count
    const countResult = await sql`SELECT COUNT(*) as count FROM artists`;
    const totalCount = countResult.rows[0]?.count || 0;
    results.push(`Total artists in database: ${totalCount}`);

    return NextResponse.json({
      success: true,
      message: 'Artists seeded successfully',
      results,
      stats: { inserted, skipped, total: totalCount },
    });
  } catch (error) {
    console.error('Seed artists error:', error);
    return NextResponse.json(
      {
        error: 'Seeding failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
