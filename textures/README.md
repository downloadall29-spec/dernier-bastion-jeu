# Sols — peintures du jeu

## Les sols utilisés depuis la version 4.24

Dix peintures **créées par le créateur du jeu avec Meshy** (abonnement avec licence
commerciale), fournies en PNG 1024 × 1024 avec les raccords vérifiés en 2 × 2, puis
converties en WebP 1024 par `outils/textures.mjs` (toutes sous 150 Ko, donc aucune
n'a besoin d'être réduite à 512).

| Fichier | Source reçue | Utilisation |
| --- | --- | --- |
| grass3.webp | texture_herbe_sombre.png | Prairie, village, marais, champs (remplace grass2.webp) |
| dirt2.webp | texture_terre.png | Chemins du Bastion et de Loup-Garou |
| sand2.webp | texture_sable.png | Plages et côte |
| pebbles2.webp | texture_galets.png | Galets, détails de terrain |
| rocky2.webp | texture_roche.png | Clairière Tiki |
| furrows2.webp | texture_sillons.png | Champs cultivés |
| lava2.webp | texture_lave.png | Antre du Démon et canaux de lave |
| snow2.webp | texture_neige.png | Pics du Yéti |
| floor2.webp | texture_parquet.png | Parquet de la maison |
| cobble2.webp | texture_paves.png | Place et chemins pavés du village |

Les anciens fichiers (`grass.jpg`, `grass2.webp`, `dirt.jpg`, `sand.jpg`, `pebbles.jpg`,
`rocky.jpg`, `furrows.jpg`, `lava.jpg`, `snow.jpg`, `floor.jpg`, `cobble.jpg`) **restent sur
le disque** : aucune mise à jour ne les supprime, et le jeu ne les utilise plus.

## Anciennes cartes Poly Haven (CC0) — conservées, plus utilisées

Dix cartes de couleur originales JPEG 1K, téléchargées le 21 octobre 2026.
Licence : [CC0](https://polyhaven.com/license), utilisable et redistribuable, y compris dans
un jeu commercial. Elles ont servi jusqu'à la 4.23.

| Fichier | Ressource | Utilisation d'origine |
| --- | --- | --- |
| grass.jpg | grass_ground | Prairie, village, Loup-Garou, variantes teintées |
| dirt.jpg | dry_ground_01 | Terre des chemins |
| sand.jpg | sand_01 | Plages et côte |
| pebbles.jpg | river_small_rocks | Galets, détails de terrain |
| rocky.jpg | rocky_terrain | Clairière Tiki |
| furrows.jpg | farm_furrows | Champs cultivés |
| lava.jpg | cracked_red_ground | Antre du Démon et canaux de lave |
| snow.jpg | snow_02 | Pics du Yéti |
| floor.jpg | wood_floor | Parquet de la maison |
| cobble.jpg | cobblestone_01 | Place et chemins pavés |

## Fonctionnement

`sources.json` liste les deux familles : les cartes Poly Haven (liens, taille, empreinte
SHA-256) et, sous `creations_createur`, les peintures du créateur (fichier, source reçue,
auteur, licence, taille, SHA-256, usage).

Le jeu lit les images de `textures/` au chargement et n'en télécharge aucune à l'exécution.
`texTile()` (src/15-ecran.js) les réduit en tuiles de rendu de 512 pixels et leur applique
la teinte du biome. Les surfaces sans raccord sont dessinées telles quelles ; l'herbe du
village reçoit en plus une mosaïque en miroir (4 variantes) et une seconde échelle de
taches, pour que la répétition ne se voie pas. Les fichiers sont copiés dans l'APK par
`android/prepare_assets.py`.

La lave reste une adaptation : sol fissuré combiné aux lueurs animées du moteur, ce n'est
pas une photographie de lave en fusion. L'eau stylisée existante est conservée.
