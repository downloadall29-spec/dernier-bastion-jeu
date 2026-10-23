# Sols Poly Haven

Dix cartes de couleur originales JPEG 1K, téléchargées le 21 octobre 2026.
Licence : [CC0](https://polyhaven.com/license), utilisable et redistribuable, y compris dans un jeu commercial.
`sources.json` contient les liens de chaque ressource, les liens directs, la taille et l'empreinte SHA-256 des fichiers. Les empreintes MD5 fournies par Poly Haven ont aussi été vérifiées au téléchargement.

| Fichier | Ressource | Utilisation |
| --- | --- | --- |
| grass.jpg | grass_ground | Prairie, village, Loup-Garou, variantes teintées des marais et champs |
| dirt.jpg | dry_ground_01 | Terre des chemins du Bastion et de Loup-Garou |
| sand.jpg | sand_01 | Plages et côte |
| pebbles.jpg | river_small_rocks | Galets, détails de terrain |
| rocky.jpg | rocky_terrain | Clairière Tiki |
| furrows.jpg | farm_furrows | Champs cultivés |
| lava.jpg | cracked_red_ground | Sol de l'Antre du Démon et canaux de lave |
| snow.jpg | snow_02 | Pics du Yéti |
| floor.jpg | wood_floor | Parquet de la maison |
| cobble.jpg | cobblestone_01 | Place et chemins pavés du village |

La lave est une adaptation : sol fissuré Poly Haven teinté, combiné aux lueurs animées du moteur. Ce n'est pas une photographie de lave en fusion. L'eau stylisée existante est conservée.

Les images restent originales sur disque ; le jeu les réduit à des tuiles de rendu de 512 pixels et applique les couleurs des biomes. Aucun relief géométrique ou carte 4K/8K n'est ajouté, pour limiter la mémoire et le coût de rendu sur tablette. Les textures sont copiées dans l'APK par `android/prepare_assets.py` et ne sont pas téléchargées à l'exécution.
