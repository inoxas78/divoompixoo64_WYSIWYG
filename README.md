☢️ Pixoo Designer OS - Vault-Tec Edition
L'Éditeur WYSIWYG Ultime et le Moteur de Rendu Avancé pour Divoom Pixoo 64 sous Home Assistant.

Merci à https://github.com/gickowtf/pixoo-homeassistant et à https://github.com/Blueforcer/awtrix3/tree/main pour la base et l'inspiration
Merci aussi à Gemini 🫣

<img width="1417" height="721" alt="image" src="https://github.com/user-attachments/assets/eb6ce010-1e12-4042-8e16-f4495b784304" />


Créer des interfaces complexes pour le Divoom Pixoo 64 via Home Assistant se résume souvent à écrire de longs blocs de YAML à l'aveugle. De plus, l'API native souffre de limitations techniques majeures (impossibilité de superposer du texte dynamique sur un GIF animé proprement, couleurs fades, rendu des polices aléatoire).

Pixoo Designer OS résout tout cela. Ce n'est pas seulement un éditeur visuel (WYSIWYG) au style rétro, c'est un véritable moteur de composition d'images et de GIFs (Baking Engine) tournant directement sur votre serveur Home Assistant via Pyscript.

🔥 Pourquoi ce projet dépasse l'intégration native (Les "Hacks" Techniques)
Normalement, avec la simple intégration divoom_pixoo, vous êtes limités à ce que l'API de l'écran peut traiter en temps réel. Pixoo Designer repousse ces limites grâce à son backend Python (pixoo_backend.py) :

⚡ Le Moteur "MultiGif" (Cuisson serveur) : L'API Divoom ne permet pas de superposer un capteur (texte) mis à jour en temps réel par-dessus un GIF animé sans provoquer de clignotements ou casser l'animation. La solution : Le backend Python récupère la valeur en direct du capteur HA, décompose le GIF de fond frame par frame, dessine le texte pixel perfect sur chaque frame, recompile le GIF optimisé, et l'envoie à l'écran.

🎨 Dithering Floyd-Steinberg (Profil Pixoo 3-3-2) : L'écran Pixoo a un espace colorimétrique limité. Les images envoyées nativement paraissent souvent ternes ou "bouchées". L'éditeur intègre un algorithme de traitement d'image qui quantifie les couleurs (8 niveaux pour R/G, 4 pour B) et applique un tramage (dithering) serpentine pour un rendu pixel-art parfait des photos et images complexes.

📸 Le "Freeze Engine" (Rastérisation) : L'intégration native ne supporte pas les formes vectorielles complexes, les dégradés ou les icônes Material Design (MDI). L'éditeur permet de dessiner ces éléments visuellement, puis les "fige" en générant instantanément un calque PNG 64x64 transparent sauvegardé sur le serveur HA.

🤖 Mode "Ultra Custom" (Pipeline Image) : Un traitement d'image poussé directement dans le navigateur avant l'export (Exposition, Saturation, Posterisation dynamique, "Smart Blur" pour lisser les aplats de couleurs, et détection de contours Sobel). Idéal pour rendre n'importe quelle image lisible sur du 64x64.

🛠️ Fonctionnalités de l'Éditeur (Frontend)
L'interface web offre une expérience de conception digne d'un logiciel de graphisme, pensée pour la matrice 64x64 :

Multi-Pages & Multimodes : Gestion de plusieurs pages avec durée personnalisée. Supporte les pages de composants libres, les pages "MultiGif" dynamiques, mais aussi les raccourcis natifs Divoom (Horloges officielles, Météo, Compteurs, Tracker d'essence).

Intégration LaMetric Transparente : Recherche, téléchargement et extraction automatique des icônes et GIFs de la base de données LaMetric (redimensionnement intelligent sur la grille 64x64).

Typographie Pixel-Perfect : Oubliez les polices système baveuses. Intègre des polices pixels sur mesure (PICO-8, GICKO, ELEVEN_PIX) avec gestion du retour à la ligne automatique (Word Wrap), de l'espacement des lignes et de l'alignement.

Outils de Conception :

Sensors HA : Glissez-déposez n'importe quelle entité HA. Affichage en direct avec gestion des décimales et des unités.

Progress Bars : Barres de progression dynamiques basées sur des capteurs (avec couleurs conditionnelles : ex. Vert si < 50, Rouge si > 50).

Formes & Dégradés : Rectangles, cercles, arrondis, remplis ou en contours, avec dégradés linéaires ou radiaux.

Gestion des Calques (Z-Order) : Montez, descendez, ciblez et verrouillez vos éléments facilement.

Export YAML & Envoi Live : Un clic génère le code YAML prêt à être collé dans Home Assistant, ou permet de "Pousser" l'image composite en direct sur le Pixoo pour tester le rendu.

⚙️ Architecture du Projet
Le système fonctionne en deux parties indissociables :

Le Frontend (index.html, script.js, style.css) : Une application web pure (hébergée dans le dossier /config/www/ de HA). Elle gère l'UI, le drag & drop, le traitement d'image initial (Canvas API), et génère les recettes JSON.

Le Backend Pyscript (pixoo_backend.py) :
Un script Python tournant sous l'intégration HA Pyscript. Il agit comme un "Worker". Ses missions :

Exposer des services asynchrones à l'UI (pixoo_upload_base64, pixoo_download_url).

Utiliser Pillow (PIL) pour manipuler les GIFs, gérer les palettes de couleurs (transparence index 255 vitale pour le Pixoo), et incruster les polices (fonts.js converti à la volée).

Assurer un rafraîchissement dynamique des pages (Tâche CRON interne) pour mettre à jour les GIFs sans intervention manuelle (pixoo_pages_refresh).

🚀 Cas d'usage Typiques
Dashboard Énergie : Un fond GIF animé de flux d'énergie, avec la consommation en Watts superposée en temps réel avec la police "Eleven Pix". (Nécessite le mode MultiGif).

Lecteur Média : Affichage de la pochette de l'album (avec le mode "Portrait" ou "Premium" pour un dithering optimal) et une barre de progression de la chanson en bas de l'écran.

Tracker de Serveur : Utilisation d'icônes MDI pour le CPU, la RAM, et le stockage, figées en un seul calque PNG optimisé, avec les pourcentages à côté.

-----------------------------------------------------------------------------------------------------------------------------------------------------------

☢️ Pixoo Designer OS - Vault-Tec Edition
The Ultimate WYSIWYG Editor and Advanced Rendering Engine for Divoom Pixoo 64 on Home Assistant.

Creating complex interfaces for the Divoom Pixoo 64 via Home Assistant often comes down to writing long blocks of YAML blindly. Moreover, the native API suffers from major technical limitations (inability to cleanly overlay dynamic text on an animated GIF, washed-out colors, random font rendering).

Pixoo Designer OS solves all of this. It's not just a retro-style visual editor (WYSIWYG); it's a true image and GIF composition engine (Baking Engine) running directly on your Home Assistant server via Pyscript.

🔥 Why this project goes beyond native integration (Technical "Hacks")
Normally, with the simple divoom_pixoo integration, you are limited to what the screen's API can process in real-time. Pixoo Designer pushes these limits thanks to its Python backend (pixoo_backend.py):

⚡ The "MultiGif" Engine (Server Baking): The Divoom API doesn't allow overlaying a real-time updated sensor (text) over an animated GIF without causing flickering or breaking the animation. The solution: The Python backend fetches the live HA sensor value, breaks down the background GIF frame by frame, draws pixel-perfect text on each frame, recompiles the optimized GIF, and sends it to the screen.

🎨 Floyd-Steinberg Dithering (Pixoo 3-3-2 Profile): The Pixoo screen has a limited color space. Natively sent images often look dull or "crushed". The editor integrates an image processing algorithm that quantizes colors (8 levels for R/G, 4 for B) and applies a serpentine dithering for perfect pixel-art rendering of complex photos and images.

📸 The "Freeze Engine" (Rasterization): The native integration doesn't support complex vector shapes, gradients, or Material Design Icons (MDI). The editor lets you draw these elements visually, then "freezes" them by instantly generating a transparent 64x64 PNG layer saved on the HA server.

🤖 "Ultra Custom" Mode (Image Pipeline): Advanced image processing directly in the browser before export (Exposure, Saturation, Dynamic Posterization, "Smart Blur" to smooth color blocks, and Sobel edge detection). Ideal for making any image readable on a 64x64 matrix.

🛠️ Editor Features (Frontend)
The web interface offers a design experience worthy of graphics software, tailored for the 64x64 matrix:

Multi-Pages & Multimodes: Manage multiple pages with custom durations. Supports free-form component pages, dynamic "MultiGif" pages, but also native Divoom shortcuts (Official Clocks, Weather, Counters, Fuel Tracker).

Seamless LaMetric Integration: Search, download, and automatically extract icons and GIFs from the LaMetric database (smart resizing to the 64x64 grid).

Pixel-Perfect Typography: Forget blurry system fonts. Includes custom pixel fonts (PICO-8, GICKO, ELEVEN_PIX) with automatic word wrap, line spacing, and alignment management.

Design Tools:

HA Sensors: Drag and drop any HA entity. Live display with decimal and unit management.

Progress Bars: Dynamic progress bars based on sensors (with conditional colors: e.g., Green if < 50, Red if > 50).

Shapes & Gradients: Rectangles, circles, rounded corners, filled or outlined, with linear or radial gradients.

Layer Management (Z-Order): Move up, down, target, and lock your elements easily.

YAML Export & Live Send: One click generates the YAML code ready to be pasted into Home Assistant, or allows you to "Push" the composite image live to the Pixoo to test the rendering.

⚙️ Project Architecture
The system works in two inseparable parts:

The Frontend (index.html, script.js, style.css): A pure web app (hosted in the HA /config/www/ folder). It manages the UI, drag & drop, initial image processing (Canvas API), and generates JSON recipes.

The Pyscript Backend (pixoo_backend.py):
A Python script running under the HA Pyscript integration. It acts as a "Worker". Its missions:

Expose asynchronous services to the UI (pixoo_upload_base64, pixoo_download_url).

Use Pillow (PIL) to manipulate GIFs, manage color palettes (transparency index 255 is vital for the Pixoo), and embed fonts (fonts.js converted on the fly).

Ensure dynamic page refreshing (internal CRON task) to update GIFs without manual intervention (pixoo_pages_refresh).

🚀 Typical Use Cases
Energy Dashboard: An animated GIF background of energy flow, with power consumption in Watts overlaid in real-time using the "Eleven Pix" font. (Requires MultiGif mode).

Media Player: Display album art (using "Portrait" or "Premium" mode for optimal dithering) and a song progress bar at the bottom of the screen.

Server Tracker: Use MDI icons for CPU, RAM, and storage, frozen into a single optimized PNG layer, with percentages next to them.
