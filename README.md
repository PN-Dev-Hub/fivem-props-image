# GTA Props Pack

Collection complete de props GTA avec images.

## Extraction depuis un dossier GTA

Tu peux generer un JSON propre depuis un dossier GTA extrait ou un GTA d'origine :

```bash
npm run extract:gta-props -- --input "D:\GTA_EXTRACT_OU_GTAV" --output ".\gta_props_from_folder.json"
```

Commande exacte pour ton dossier:

```powershell
Set-Location "F:\Bureau\txData\script\props"
npm run extract:gta-props -- --input "F:\Epic Games\GTAV" --output ".\gta_props_from_folder.json"
```
Set-Location "F:\Bureau\txData\script\props"
npm run extract:gta-props -- --input "F:\Epic Games\GTAV" --output ".\gta_props_from_folder.json"

Options utiles :

- `--group-by category` pour un rendu proche de `fivem_props.json`
- `--group-by source` pour grouper par pack/source
- `--mode props` pour filtrer les modeles orientes props
- `--mode all` pour tout sortir
- `--image-base-url` pour definir la base URL des images
- `--image-extension` pour changer l'extension (`.jpg` par defaut)

Le script lit les modeles `.ydr/.ydd` et les `.ytyp.xml` quand ils sont presents.
Sur un GTA d'origine, il lit aussi directement les archives `.rpf` (mode `auto`).
Si la lecture `.rpf` est partielle selon la version du jeu, il utilise `strings.txt` comme fallback (noms/hash/images, avec moins de metadata de chemin).
Dans ce mode, les champs `patchRpfFilePath`, `patchModelFilePathHint` et `patchModelFilePathHintAlt` sont ajoutes pour prioriser les fichiers patch.
Le champ `image` est genere automatiquement au format `.../images/<categorie>/<model>.jpg`.

## Structure

```bash
images/categorie/prop.jpg
```

## Categories

- [Bar](docs/categories/bar.md)
- [Bathroom](docs/categories/bathroom.md)
- [Bins](docs/categories/bins.md)
- [Bush](docs/categories/bush.md)
- [Cacti](docs/categories/cacti.md)
- [Construction](docs/categories/construction.md)
- [Crops](docs/categories/crops.md)
- [Doors](docs/categories/doors.md)
- [Electrical](docs/categories/electrical.md)
- [Ext_veg](docs/categories/ext_veg.md)
- [Fanpalm](docs/categories/fanpalm.md)
- [Farm](docs/categories/farm.md)
- [Fastfood](docs/categories/fastfood.md)
- [Fences](docs/categories/fences.md)
- [Fences_2](docs/categories/fences_2.md)
- [Files_last](docs/categories/files_last.md)
- [Garage](docs/categories/garage.md)
- [Garden](docs/categories/garden.md)
- [Halloween](docs/categories/halloween.md)
- [Industrial](docs/categories/industrial.md)
- [Kitchen](docs/categories/kitchen.md)
- [Minigame](docs/categories/minigame.md)
- [Office](docs/categories/office.md)
- [Other](docs/categories/other.md)
- [Palm](docs/categories/palm.md)
- [Pieces](docs/categories/pieces.md)
- [Potted](docs/categories/potted.md)
- [Procedural](docs/categories/procedural.md)
- [Recreational](docs/categories/recreational.md)
- [Rocks](docs/categories/rocks.md)
- [Rooftop](docs/categories/rooftop.md)
- [Rubbish](docs/categories/rubbish.md)
- [Seating](docs/categories/seating.md)
- [Seating_tables](docs/categories/seating_tables.md)
- [Signs](docs/categories/signs.md)
- [Snow](docs/categories/snow.md)
- [Storage](docs/categories/storage.md)
- [Traffic_lights](docs/categories/traffic_lights.md)
- [Trees](docs/categories/trees.md)
- [Utility](docs/categories/utility.md)
