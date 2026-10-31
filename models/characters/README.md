# Personnages Quaternius Standard

Sources officielles :
- https://quaternius.itch.io/universal-base-characters
- https://quaternius.itch.io/modular-character-outfits-fantasy

Archives Standard fournies par l’utilisateur, licences CC0 incluses dans LICENSE-1.txt et LICENSE-2.txt. Aucun contenu Source payant inclus.

Reconstruction : `python scripts/prepare-quaternius.py <dossier des deux archives extraites>` (Pillow requis). Les GLB embarquent les maillages, squelettes et textures couleur réduites à 512 px. Les têtes sont dérivées des corps par sélection des triangles au-dessus du cou. Les textures normales et de rugosité inutilisées par le rendu toon sont omises.

Le module character-models.js assemble les corps de prévisualisation, les têtes habillées, les coiffures et les tenues. Les différences de hauteur des coiffures masculines et féminines sont compensées. Sous une capuche, seuls les triangles visibles de la frange et de la nuque sont conservés sur une copie, sans changer la coiffure enregistrée. Le retrait de la capuche restitue la coiffure complète. Les animations de repos et marche sont procédurales : ces archives ne contiennent pas de clips animés.

Les choix sont conservés dans appearance pour chaque sauvegarde. Les anciennes sauvegardes reçoivent une apparence par défaut sans effacer progression ou équipements. Paramètres > Modifier mon personnage permet de la personnaliser. Les chapeaux, capes et bottes existants sont attachés au nouveau squelette ; les équipements achetés et leurs bonus sont préservés. L’assemblage est prévu pour de nouvelles pièces compatibles, mais chaque futur modèle nécessitera un contrôle des intersections en mouvement.

Tribus : Gardiens (rôdeur, étoffe rouge), Éclaireurs (rôdeur vert, capuche) et Mystiques (paysan, lin violet). L’étoffe est recolorée à la volée sur une copie de la texture ; la peau (5 teintes) est appliquée en couleur multipliée sur la texture claire. Les troupes du village portent la tenue de la tribu.
