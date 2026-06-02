(function () {
  "use strict";

  const SUPPORTED_LANGS = new Set(["da", "en", "fr"]);
  const STORAGE_KEY = "fjordshare.language.v1";
  const script = document.currentScript || null;
  const textState = new WeakMap();
  const titleSource = document.title || "";
  let observer = null;
  let currentLang = normalizeLang(
    (script && script.dataset.userLanguage === "1" ? script.dataset.currentLanguage : "") ||
    readStoredLanguage() ||
    (script && script.dataset.currentLanguage) ||
    document.documentElement.getAttribute("lang") ||
    "da",
  );

  const TEXT = {
    en: {
      "Afslut vælg": "Exit selection",
      "Afslut vælg mode": "Exit selection mode",
      "Afsluttede projekter og genprint": "Completed projects and reprints",
      "Delt mappe  -  Fjord3D": "Shared folder - Fjord3D",
      "Afsluttede projekter som kan sendes til print igen.": "Completed projects that can be sent to print again.",
      "Afviste filtyper": "Rejected file types",
      "Adgangskode": "Password",
      "Admin": "Admin",
      "Admin brugernavn": "Admin username",
      "Afsender navn": "Sender name",
      "Aktiv": "Active",
      "Aktiveres når alle antal er printet": "Enabled when all quantities are printed",
      "Aktivér SMS gateway": "Enable SMS gateway",
      "Aktivér SMS": "Enable SMS",
      "Aktivitetslog over uploads, thumbnails, slicing, ZIP-job og sletninger.": "Activity log for uploads, thumbnails, slicing, ZIP jobs and deletions.",
      "Alle": "All",
      "Allerede sendt": "Already sent",
      "Alt er printet": "Everything is printed",
      "Annuller": "Cancel",
      "Annuller thumbnail-generering": "Cancel thumbnail generation",
      "Antal": "Count",
      "Antal printet nu": "Quantity printed now",
      "App guide": "App guide",
      "Arbejder...": "Working...",
      "Baggrundsjob kører": "Background jobs running",
      "Beskrivelse": "Description",
      "Billede": "Image",
      "Billeder fra linket": "Images from the link",
      "Bring pakker og manuelle tracking-opdateringer": "Bring parcels and manual tracking updates",
      "Bemærkning": "Note",
      "Bruger": "User",
      "Brug ekstern DNS base-url": "Use external DNS base URL",
      "Bruger oprettet. Log ind herunder.": "User created. Log in below.",
      "Brugere": "Users",
      "Brugernavn": "Username",
      "Bruges til delte links, fx https://files.eksempel.dk": "Used for shared links, e.g. https://files.example.com",
      "Brug internationalt nummer uden plus, eller et dansk 8-cifret nummer.": "Use an international number without plus, or an 8-digit Danish number.",
      "By Glerup": "By Glerup",
      "Del": "Share",
      "Delinger": "Shares",
      "Delinger, DNS, brugere, SMS og slicer-profiler": "Shares, DNS, users, SMS and slicer profiles",
      "Delt med": "Shared with",
      "Din brugerprofil og SMS-indstillinger": "Your user profile and SMS settings",
      "Din oprettelse afventer godkendelse.": "Your signup is awaiting approval.",
      "Dit fulde efternavn bliver ikke gemt. Vi gemmer kun forbogstavet.": "Your full last name is not stored. Only the initial is saved.",
      "DNS / Ekstern base-url": "DNS / external base URL",
      "Download": "Download",
      "Download PDF produktions info": "Download PDF production info",
      "Download zip fil": "Download ZIP file",
      "Du kan logge ind, når en administrator har godkendt profilen.": "You can log in once an administrator has approved the profile.",
      "Eksisterende delinger": "Existing shares",
      "Enhed": "Unit",
      "Efternavn": "Last name",
      "Efternavn / initial": "Last name / initial",
      "Filer": "Files",
      "Fil": "File",
      "Fil/Job": "File/Job",
      "Fil-info": "File info",
      "Filament forbrug i gram": "Filament use in grams",
      "Filament forbrug i kr.": "Filament cost in DKK",
      "Filament profil (filament.json)": "Filament profile (filament.json)",
      "Filer på linket": "Files on the link",
      "Filer i alt": "Files total",
      "Filtype": "File type",
      "Filtyper der er forsøgt uploadet, men afvist": "File types that were attempted uploaded but rejected",
      "Filtyper som er blevet afvist ved upload eller inde i ZIP-filer.": "File types rejected during upload or inside ZIP files.",
      "Fjern": "Remove",
      "Fjernet": "Removed",
      "Force guide": "Force guide",
      "Forrige": "Previous",
      "Fravælg alle": "Deselect all",
      "Færdig": "Done",
      "Færdige projekter": "Completed projects",
      "Færdigmeld projekt": "Complete project",
      "Fornavn": "First name",
      "Første opsætning": "First setup",
      "Login  -  Fjord3D": "Login - Fjord3D",
      "Opret profil - Fjord3D": "Create profile - Fjord3D",
      "Setup  -  Fjord3D": "Setup - Fjord3D",
      "Tracking - Fjord3D": "Tracking - Fjord3D",
      "Gem": "Save",
      "Gem DNS": "Save DNS",
      "Gem SMS": "Save SMS",
      "Gem mapping": "Save mapping",
      "Gem og se projekt": "Save and view project",
      "Gem profil": "Save profile",
      "Gem som objekt": "Save as object",
      "Gem størrelse": "Save size",
      "Gem tildeling": "Save assignment",
      "Gem ændringer": "Save changes",
      "Gemmer...": "Saving...",
      "Generer link": "Generate link",
      "Genererer 3D thumbnail...": "Generating 3D thumbnail...",
      "Gentag adgangskode": "Repeat password",
      "Gentag kode": "Repeat password",
      "Guide": "Guide",
      "Guide klar": "Guide ready",
      "Gyldig i": "Valid for",
      "Gå til login": "Go to login",
      "Gemt i projektet": "Saved in the project",
      "Gennemse projektet her. Når du er klar, klik \"Send til print\" for at sende til admin.": "Review the project here. When ready, click \"Send to print\" to send it to admin.",
      "Handling": "Action",
      "Hjem": "Home",
      "Hjemmemappe": "Home folder",
      "Hjemmeside": "Website",
      "ID": "ID",
      "Ikke nu": "Not now",
      "Ikke bruger mappe": "Non-user folder",
      "Indlæser filer...": "Loading files...",
      "Indlæser process settings...": "Loading process settings...",
      "Indlæser printer-mapping...": "Loading printer mapping...",
      "Indlæser slicer-status...": "Loading slicer status...",
      "Indstillinger": "Settings",
      "Ingen aktiv upload": "No active upload",
      "Ingen afviste filtyper logget endnu.": "No rejected file types logged yet.",
      "Ingen billeder tilknyttet denne fil endnu.": "No images attached to this file yet.",
      "Ingen delinger endnu.": "No shares yet.",
      "Ingen fil valgt": "No file selected",
      "Ingen filer uploadet.": "No files uploaded.",
      "Ingen filnavne matcher søgningen.": "No filenames match the search.",
      "Ingen loghændelser fundet.": "No log events found.",
      "Ingen oprettelseslinks.": "No signup links.",
      "Ingen oprettelser afventer godkendelse.": "No signups awaiting approval.",
      "Ingen printere i mapping endnu. Klik på \"Tilføj printer\".": "No printers in the mapping yet. Click \"Add printer\".",
      "Ingen process settings indlæst.": "No process settings loaded.",
      "Ingen settings matcher denne fane/søgning.": "No settings match this tab/search.",
      "Ingen slicede filer endnu.": "No sliced files yet.",
      "Ingen trackingnumre endnu.": "No tracking numbers yet.",
      "Ingen brugere.": "No users.",
      "Initial": "Initial",
      "Jeg har ingen links til modellerne": "I do not have links for the models",
      "Kilde": "Source",
      "Klar": "Ready",
      "Klar til print": "Ready to print",
      "Kode": "Password",
      "Konfigurationsbundle (INI/CFG)": "Configuration bundle (INI/CFG)",
      "Kontekst": "Context",
      "Kopier": "Copy",
      "Kontrol": "Controls",
      "Kræv besøgsnavn": "Require visitor name",
      "Land": "Country",
      "Label-filen gemmes ikke permanent.": "The label file is not stored permanently.",
      "Link": "Link",
      "Linket giver adgang til denne ene forsendelse. Siden opdaterer automatisk ved åbning og har kun en Opdater-knap.": "The link gives access to this single shipment. The page refreshes automatically when opened and only has a Refresh button.",
      "Linket er brugt": "The link has been used",
      "Linket kan ikke bruges": "The link cannot be used",
      "Log ind": "Log in",
      "Log ind på Fjord3D": "Log in to Fjord3D",
      "Log ud": "Log out",
      "Logs": "Logs",
      "Luk": "Close",
      "Mappe": "Folder",
      "Mappenavn": "Folder name",
      "Mapper": "Folders",
      "Mapper, upload og metadata": "Folders, upload and metadata",
      "Metadata": "Metadata",
      "Minimer": "Minimize",
      "Model": "Model",
      "Model-link": "Model link",
      "Måler...": "Measuring...",
      "Navn": "Name",
      "Nej tak": "No thanks",
      "Næste": "Next",
      "Nulstil mapping": "Reset mapping",
      "Nulstil token": "Reset token",
      "Ny kode": "New password",
      "Ny mappe i valgt mappe": "New folder in selected folder",
      "Nye uploadede filer, ikke set": "New uploaded files, not seen",
      "Nuværende kode": "Current password",
      "Når token er gemt, vises kun de første tegn. Klik i feltet for at skrive en ny.": "Once the token is saved, only the first characters are shown. Click the field to write a new one.",
      "OK": "OK",
      "Omdøb mappe": "Rename folder",
      "Opdater": "Refresh",
      "Opdater debug": "Refresh debug",
      "Opret admin": "Create admin",
      "Opret den første admin-konto.": "Create the first admin account.",
      "Opret mappe": "Create folder",
      "Opret deling": "Create share",
      "Opret profil": "Create profile",
      "Opret-links": "Signup links",
      "Oprettelse sendt": "Signup sent",
      "Oprettelser afventer godkendelse": "Signups awaiting approval",
      "Oprettet": "Created",
      "Opret ny deling fra Mapper via Vælg mode -> Del.": "Create a new share from Folders via Select mode -> Share.",
      "Pakke": "Package",
      "Pakkenummer": "Parcel number",
      "PDF": "PDF",
      "Beskyt med kode": "Protect with password",
      "Print settings (process.json)": "Print settings (process.json)",
      "Print status": "Print status",
      "Print tid total": "Total print time",
      "Print time": "Print time",
      "Printprofil": "Print profile",
      "Printer pladestørrelser": "Printer bed sizes",
      "Printer profil (machine.json)": "Printer profile (machine.json)",
      "Printerprofil": "Printer profile",
      "Printet": "Printed",
      "Profil": "Profile",
      "Profil uploads": "Profile uploads",
      "Profilmenu og guideindstillinger": "Profile menu and guide settings",
      "Projekter der er markeret klar til produktion.": "Projects marked ready for production.",
      "Projekter klar til print": "Projects ready to print",
      "Projekter markeret klar til produktion": "Projects marked ready for production",
      "Projekt": "Project",
      "Projekt færdig": "Project complete",
      "Projekt færdigt": "Project completed",
      "Projekt navn": "Project name",
      "Projektfiler": "Project files",
      "Rediger": "Edit",
      "Rediger bruger": "Edit user",
      "Rettighed": "Permission",
      "Rolle": "Role",
      "Ryd aktivitetslog": "Clear activity log",
      "Ryd log": "Clear log",
      "Ryd logs": "Clear logs",
      "Ryd søgning": "Clear search",
      "Se": "View",
      "Se og upload": "View and upload",
      "Se, upload og slet": "View, upload and delete",
      "Sæt SMS_TOKEN_ENCRYPTION_KEY i miljøet for krypteret lagring af token.": "Set SMS_TOKEN_ENCRYPTION_KEY in the environment to store the token encrypted.",
      "Senest": "Latest",
      "Seneste fil": "Latest file",
      "Seneste hændelse": "Latest event",
      "Seneste uploads": "Latest uploads",
      "Send kode": "Send code",
      "Send ny kode": "Send new code",
      "Send test-SMS": "Send test SMS",
      "Send til godkendelse": "Send for approval",
      "Send til print": "Send to print",
      "Sender...": "Sending...",
      "Sidst opdateret": "Last updated",
      "Skriv nyt token": "Write new token",
      "Skriv nyt token ved ændring": "Write a new token to change it",
      "Slice fejl": "Slice error",
      "Slice slået fra": "Slicing disabled",
      "Slicede filer": "Sliced files",
      "Slicer": "Slicer",
      "Slicer profiler": "Slicer profiles",
      "Slicing er midlertidigt slået fra": "Slicing is temporarily disabled",
      "Skala": "Scale",
      "Skal den printes større end originalfilen?": "Should it be printed larger than the original file?",
      "Slå fra hvis du ikke ønsker, at guiden vises automatisk.": "Turn this off if you do not want the guide to appear automatically.",
      "Slip filer eller mapper her for at uploade til valgt mappe": "Drop files or folders here to upload to the selected folder",
      "SMS Gateway (GatewayAPI)": "SMS Gateway (GatewayAPI)",
      "SMS opdateringer": "SMS updates",
      "Sprog": "Language",
      "Sproget bruges nu i brugerfladen. Du kan skifte igen når som helst.": "The language is now used in the interface. You can change it again at any time.",
      "Spring over": "Skip",
      "Spring over og se projekt": "Skip and view project",
      "Status": "Status",
      "Stop alle": "Stop all",
      "Stop upload": "Stop upload",
      "Stoppet": "Stopped",
      "Stoppet af bruger": "Stopped by user",
      "Stopper...": "Stopping...",
      "Størrelse": "Size",
      "Søg filnavn...": "Search filename...",
      "Søg filer": "Search files",
      "Telefon med landekode": "Phone with country code",
      "Telefonnummer": "Phone number",
      "Test modtager": "Test recipient",
      "Thumbnails: Klar": "Thumbnails: Ready",
      "Tid": "Time",
      "Timer": "Hours",
      "Tilbage": "Back",
      "Tilføj": "Add",
      "Tilføj bruger": "Add user",
      "Tilføj de relevante detaljer for den valgte fil.": "Add the relevant details for the selected file.",
      "Tilføj link": "Add link",
      "Tilføj link som objekt": "Add link as object",
      "Tilføj model-link pr. fil": "Add model link per file",
      "Tilføj nummer": "Add number",
      "Tilføj valgfrit et trackingnummer manuelt eller udtræk det fra en pakkelabel (PDF). Label-filen gemmes ikke permanent.": "Optionally add a tracking number manually or extract it from a parcel label (PDF). The label file is not stored permanently.",
      "Tilføj printer": "Add printer",
      "Tracking": "Tracking",
      "Tracking / pakkenummer": "Tracking / parcel number",
      "Træk og slip en label-PDF her": "Drag and drop a label PDF here",
      "Træk filer hertil, eller klik for at vælge.": "Drag files here, or click to choose.",
      "Træk filer ind i feltet, eller vælg filer manuelt.": "Drag files into the field, or choose files manually.",
      "Træk for rotation, scroll for zoom": "Drag to rotate, scroll to zoom",
      "Træk for at rotere view, scroll for zoom, højreklik for pan.": "Drag to rotate the view, scroll to zoom, right-click to pan.",
      "Tjek hver fil før projektet sendes til print.": "Check each file before the project is sent to print.",
      "Type": "Type",
      "Udtræk fra pakkelabel (PDF)": "Extract from parcel label (PDF)",
      "Udtræk og tilføj": "Extract and add",
      "Udfyld felterne herunder. Profilen oprettes først, når den er godkendt.": "Fill in the fields below. The profile is created only after approval.",
      "Upload": "Upload",
      "Upload filer": "Upload files",
      "Upload valgte filer": "Upload selected files",
      "Upload billede": "Upload image",
      "Upload profiler her, så de gemmes i den korrekte profilmappe og bruges automatisk i slicing. Du kan trække og slippe flere filer ad gangen i hvert felt.": "Upload profiles here so they are saved in the correct profile folder and used automatically for slicing. You can drag and drop several files at a time in each field.",
      "Uploads": "Uploads",
      "Uploadet": "Uploaded",
      "Used filament": "Used filament",
      "Vent venligst": "Please wait",
      "Vis debug": "Show debug",
      "Vis detaljer": "Show details",
      "Vis fil-info": "Show file info",
      "Vis guide": "Show guide",
      "Vis guide automatisk ved login": "Show guide automatically on login",
      "Vælg": "Choose",
      "Vælg bruger": "Choose user",
      "Vælg de mapper der skal deles, og sæt rettigheder/udløb.": "Choose the folders to share and set permissions/expiry.",
      "Vælg filer til print": "Select files for print",
      "Vælg filer": "Choose files",
      "Vælg label-PDF": "Choose label PDF",
      "Vælg mode": "Select mode",
      "Vælg producent/model for auto X/Y. Brug Edit til manuel finjustering af pladestørrelse.": "Choose manufacturer/model for automatic X/Y. Use Edit for manual fine-tuning of bed size.",
      "Vælg sprog": "Choose language",
      "Vil du modtage SMS når dine projekter opdateres?": "Would you like to receive SMS when your projects are updated?",
      "ZIP": "ZIP",
      "Åbn 3D": "Open 3D",
      "Åbn billede i stor visning": "Open image in large view",
      "Åbn link": "Open link",
      "Årsag": "Reason",
      "Ændringer gemt. Udfyld begge kodefelter for at gemme adgangskode.": "Changes saved. Fill in both password fields to save the password.",
    },
    fr: {
      "Afslut vælg": "Quitter la sélection",
      "Afslut vælg mode": "Quitter le mode sélection",
      "Afsluttede projekter og genprint": "Projets terminés et réimpressions",
      "Delt mappe  -  Fjord3D": "Dossier partagé - Fjord3D",
      "Afsluttede projekter som kan sendes til print igen.": "Projets terminés pouvant être renvoyés en impression.",
      "Afviste filtyper": "Types de fichiers refusés",
      "Adgangskode": "Mot de passe",
      "Admin": "Admin",
      "Admin brugernavn": "Nom d'utilisateur admin",
      "Afsender navn": "Nom d'expéditeur",
      "Aktiv": "Actif",
      "Aktiveres når alle antal er printet": "Activé lorsque toutes les quantités sont imprimées",
      "Aktivér SMS gateway": "Activer la passerelle SMS",
      "Aktivér SMS": "Activer les SMS",
      "Aktivitetslog over uploads, thumbnails, slicing, ZIP-job og sletninger.": "Journal des téléversements, miniatures, découpes, tâches ZIP et suppressions.",
      "Alle": "Tous",
      "Allerede sendt": "Déjà envoyé",
      "Alt er printet": "Tout est imprimé",
      "Annuller": "Annuler",
      "Annuller thumbnail-generering": "Annuler la génération des miniatures",
      "Antal": "Nombre",
      "Antal printet nu": "Quantité imprimée maintenant",
      "App guide": "Guide de l'application",
      "Arbejder...": "Traitement...",
      "Baggrundsjob kører": "Tâches en arrière-plan en cours",
      "Beskrivelse": "Description",
      "Billede": "Image",
      "Billeder fra linket": "Images du lien",
      "Bring pakker og manuelle tracking-opdateringer": "Colis Bring et mises à jour de suivi manuelles",
      "Bemærkning": "Remarque",
      "Bruger": "Utilisateur",
      "Brug ekstern DNS base-url": "Utiliser l'URL de base DNS externe",
      "Bruger oprettet. Log ind herunder.": "Utilisateur créé. Connectez-vous ci-dessous.",
      "Brugere": "Utilisateurs",
      "Brugernavn": "Nom d'utilisateur",
      "Bruges til delte links, fx https://files.eksempel.dk": "Utilisé pour les liens partagés, p. ex. https://files.example.com",
      "Brug internationalt nummer uden plus, eller et dansk 8-cifret nummer.": "Utilisez un numéro international sans plus, ou un numéro danois à 8 chiffres.",
      "By Glerup": "Par Glerup",
      "Del": "Partager",
      "Delinger": "Partages",
      "Delinger, DNS, brugere, SMS og slicer-profiler": "Partages, DNS, utilisateurs, SMS et profils slicer",
      "Delt med": "Partagé avec",
      "Din brugerprofil og SMS-indstillinger": "Votre profil utilisateur et vos paramètres SMS",
      "Din oprettelse afventer godkendelse.": "Votre inscription attend l'approbation.",
      "Dit fulde efternavn bliver ikke gemt. Vi gemmer kun forbogstavet.": "Votre nom complet n'est pas stocké. Seule l'initiale est enregistrée.",
      "DNS / Ekstern base-url": "DNS / URL de base externe",
      "Download": "Télécharger",
      "Download PDF produktions info": "Télécharger les infos de production PDF",
      "Download zip fil": "Télécharger le fichier ZIP",
      "Du kan logge ind, når en administrator har godkendt profilen.": "Vous pourrez vous connecter après l'approbation du profil par un administrateur.",
      "Eksisterende delinger": "Partages existants",
      "Enhed": "Unité",
      "Efternavn": "Nom",
      "Efternavn / initial": "Nom / initiale",
      "Filer": "Fichiers",
      "Fil": "Fichier",
      "Fil/Job": "Fichier/Tâche",
      "Fil-info": "Info fichier",
      "Filament forbrug i gram": "Consommation de filament en grammes",
      "Filament forbrug i kr.": "Coût du filament en DKK",
      "Filament profil (filament.json)": "Profil filament (filament.json)",
      "Filer på linket": "Fichiers du lien",
      "Filer i alt": "Fichiers au total",
      "Filtype": "Type de fichier",
      "Filtyper der er forsøgt uploadet, men afvist": "Types de fichiers téléversés mais refusés",
      "Filtyper som er blevet afvist ved upload eller inde i ZIP-filer.": "Types de fichiers refusés au téléversement ou dans les fichiers ZIP.",
      "Fjern": "Supprimer",
      "Fjernet": "Supprimé",
      "Force guide": "Forcer le guide",
      "Forrige": "Précédent",
      "Fravælg alle": "Tout désélectionner",
      "Færdig": "Terminé",
      "Færdige projekter": "Projets terminés",
      "Færdigmeld projekt": "Terminer le projet",
      "Fornavn": "Prénom",
      "Første opsætning": "Première configuration",
      "Login  -  Fjord3D": "Connexion - Fjord3D",
      "Opret profil - Fjord3D": "Créer un profil - Fjord3D",
      "Setup  -  Fjord3D": "Configuration - Fjord3D",
      "Tracking - Fjord3D": "Suivi - Fjord3D",
      "Gem": "Enregistrer",
      "Gem DNS": "Enregistrer DNS",
      "Gem SMS": "Enregistrer SMS",
      "Gem mapping": "Enregistrer le mapping",
      "Gem og se projekt": "Enregistrer et voir le projet",
      "Gem profil": "Enregistrer le profil",
      "Gem som objekt": "Enregistrer comme objet",
      "Gem størrelse": "Enregistrer la taille",
      "Gem tildeling": "Enregistrer l'attribution",
      "Gem ændringer": "Enregistrer les modifications",
      "Gemmer...": "Enregistrement...",
      "Generer link": "Générer un lien",
      "Genererer 3D thumbnail...": "Génération de la miniature 3D...",
      "Gentag adgangskode": "Répéter le mot de passe",
      "Gentag kode": "Répéter le mot de passe",
      "Guide": "Guide",
      "Guide klar": "Guide prêt",
      "Gyldig i": "Valide pendant",
      "Gå til login": "Aller à la connexion",
      "Gemt i projektet": "Enregistré dans le projet",
      "Gennemse projektet her. Når du er klar, klik \"Send til print\" for at sende til admin.": "Vérifiez le projet ici. Quand vous êtes prêt, cliquez sur « Envoyer à l'impression » pour l'envoyer à l'admin.",
      "Handling": "Action",
      "Hjem": "Accueil",
      "Hjemmemappe": "Dossier personnel",
      "Hjemmeside": "Site web",
      "ID": "ID",
      "Ikke nu": "Pas maintenant",
      "Ikke bruger mappe": "Dossier non utilisateur",
      "Indlæser filer...": "Chargement des fichiers...",
      "Indlæser process settings...": "Chargement des paramètres de processus...",
      "Indlæser printer-mapping...": "Chargement du mapping imprimante...",
      "Indlæser slicer-status...": "Chargement du statut slicer...",
      "Indstillinger": "Paramètres",
      "Ingen aktiv upload": "Aucun téléversement actif",
      "Ingen afviste filtyper logget endnu.": "Aucun type de fichier refusé enregistré.",
      "Ingen billeder tilknyttet denne fil endnu.": "Aucune image jointe à ce fichier.",
      "Ingen delinger endnu.": "Aucun partage pour le moment.",
      "Ingen fil valgt": "Aucun fichier sélectionné",
      "Ingen filer uploadet.": "Aucun fichier téléversé.",
      "Ingen filnavne matcher søgningen.": "Aucun nom de fichier ne correspond à la recherche.",
      "Ingen loghændelser fundet.": "Aucun événement de journal trouvé.",
      "Ingen oprettelseslinks.": "Aucun lien d'inscription.",
      "Ingen oprettelser afventer godkendelse.": "Aucune inscription en attente d'approbation.",
      "Ingen printere i mapping endnu. Klik på \"Tilføj printer\".": "Aucune imprimante dans le mapping. Cliquez sur « Ajouter une imprimante ».",
      "Ingen process settings indlæst.": "Aucun paramètre de processus chargé.",
      "Ingen settings matcher denne fane/søgning.": "Aucun paramètre ne correspond à cet onglet/cette recherche.",
      "Ingen slicede filer endnu.": "Aucun fichier découpé pour le moment.",
      "Ingen trackingnumre endnu.": "Aucun numéro de suivi pour le moment.",
      "Ingen brugere.": "Aucun utilisateur.",
      "Initial": "Initiale",
      "Jeg har ingen links til modellerne": "Je n'ai pas de liens pour les modèles",
      "Kilde": "Source",
      "Klar": "Prêt",
      "Klar til print": "Prêt à imprimer",
      "Kode": "Mot de passe",
      "Konfigurationsbundle (INI/CFG)": "Lot de configuration (INI/CFG)",
      "Kontekst": "Contexte",
      "Kopier": "Copier",
      "Kontrol": "Contrôles",
      "Kræv besøgsnavn": "Exiger le nom du visiteur",
      "Land": "Pays",
      "Label-filen gemmes ikke permanent.": "Le fichier d'étiquette n'est pas stocké définitivement.",
      "Link": "Lien",
      "Linket giver adgang til denne ene forsendelse. Siden opdaterer automatisk ved åbning og har kun en Opdater-knap.": "Le lien donne accès à cet envoi uniquement. La page s'actualise automatiquement à l'ouverture et ne contient qu'un bouton Actualiser.",
      "Linket er brugt": "Le lien a été utilisé",
      "Linket kan ikke bruges": "Le lien ne peut pas être utilisé",
      "Log ind": "Connexion",
      "Log ind på Fjord3D": "Connexion à Fjord3D",
      "Log ud": "Déconnexion",
      "Logs": "Journaux",
      "Luk": "Fermer",
      "Mappe": "Dossier",
      "Mappenavn": "Nom du dossier",
      "Mapper": "Dossiers",
      "Mapper, upload og metadata": "Dossiers, téléversement et métadonnées",
      "Metadata": "Métadonnées",
      "Minimer": "Réduire",
      "Model": "Modèle",
      "Model-link": "Lien modèle",
      "Måler...": "Mesure...",
      "Navn": "Nom",
      "Nej tak": "Non merci",
      "Næste": "Suivant",
      "Nulstil mapping": "Réinitialiser le mapping",
      "Nulstil token": "Réinitialiser le jeton",
      "Ny kode": "Nouveau mot de passe",
      "Ny mappe i valgt mappe": "Nouveau dossier dans le dossier sélectionné",
      "Nye uploadede filer, ikke set": "Nouveaux fichiers téléversés, non vus",
      "Nuværende kode": "Mot de passe actuel",
      "Når token er gemt, vises kun de første tegn. Klik i feltet for at skrive en ny.": "Une fois le jeton enregistré, seuls les premiers caractères sont affichés. Cliquez dans le champ pour en écrire un nouveau.",
      "OK": "OK",
      "Omdøb mappe": "Renommer le dossier",
      "Opdater": "Actualiser",
      "Opdater debug": "Actualiser le débogage",
      "Opret admin": "Créer l'admin",
      "Opret den første admin-konto.": "Créer le premier compte admin.",
      "Opret mappe": "Créer un dossier",
      "Opret deling": "Créer un partage",
      "Opret profil": "Créer un profil",
      "Opret-links": "Liens d'inscription",
      "Oprettelse sendt": "Inscription envoyée",
      "Oprettelser afventer godkendelse": "Inscriptions en attente d'approbation",
      "Oprettet": "Créé",
      "Opret ny deling fra Mapper via Vælg mode -> Del.": "Créez un nouveau partage depuis Dossiers via Mode sélection -> Partager.",
      "Pakke": "Colis",
      "Pakkenummer": "Numéro de colis",
      "PDF": "PDF",
      "Beskyt med kode": "Protéger par mot de passe",
      "Print settings (process.json)": "Paramètres d'impression (process.json)",
      "Print status": "Statut d'impression",
      "Print tid total": "Temps d'impression total",
      "Print time": "Temps d'impression",
      "Printprofil": "Profil d'impression",
      "Printer pladestørrelser": "Dimensions du plateau",
      "Printer profil (machine.json)": "Profil imprimante (machine.json)",
      "Printerprofil": "Profil imprimante",
      "Printet": "Imprimé",
      "Profil": "Profil",
      "Profil uploads": "Téléversements de profils",
      "Profilmenu og guideindstillinger": "Menu profil et paramètres du guide",
      "Projekter der er markeret klar til produktion.": "Projets marqués comme prêts pour la production.",
      "Projekter klar til print": "Projets prêts à imprimer",
      "Projekter markeret klar til produktion": "Projets marqués comme prêts pour la production",
      "Projekt": "Projet",
      "Projekt færdig": "Projet terminé",
      "Projekt færdigt": "Projet terminé",
      "Projekt navn": "Nom du projet",
      "Projektfiler": "Fichiers du projet",
      "Rediger": "Modifier",
      "Rediger bruger": "Modifier l'utilisateur",
      "Rettighed": "Droit",
      "Rolle": "Rôle",
      "Ryd aktivitetslog": "Effacer le journal d'activité",
      "Ryd log": "Effacer le journal",
      "Ryd logs": "Effacer les journaux",
      "Ryd søgning": "Effacer la recherche",
      "Se": "Voir",
      "Se og upload": "Voir et téléverser",
      "Se, upload og slet": "Voir, téléverser et supprimer",
      "Sæt SMS_TOKEN_ENCRYPTION_KEY i miljøet for krypteret lagring af token.": "Définissez SMS_TOKEN_ENCRYPTION_KEY dans l'environnement pour stocker le jeton chiffré.",
      "Senest": "Dernier",
      "Seneste fil": "Dernier fichier",
      "Seneste hændelse": "Dernier événement",
      "Seneste uploads": "Derniers téléversements",
      "Send kode": "Envoyer le code",
      "Send ny kode": "Envoyer un nouveau code",
      "Send test-SMS": "Envoyer un SMS de test",
      "Send til godkendelse": "Envoyer pour approbation",
      "Send til print": "Envoyer à l'impression",
      "Sender...": "Envoi...",
      "Sidst opdateret": "Dernière mise à jour",
      "Skriv nyt token": "Écrire un nouveau jeton",
      "Skriv nyt token ved ændring": "Écrire un nouveau jeton pour le modifier",
      "Slice fejl": "Erreur de découpe",
      "Slice slået fra": "Slicing désactivé",
      "Slicede filer": "Fichiers découpés",
      "Slicer": "Slicer",
      "Slicer profiler": "Profils slicer",
      "Slicing er midlertidigt slået fra": "Le slicing est temporairement désactivé",
      "Skala": "Échelle",
      "Skal den printes større end originalfilen?": "Doit-il être imprimé plus grand que le fichier original ?",
      "Slå fra hvis du ikke ønsker, at guiden vises automatisk.": "Désactivez cette option si vous ne voulez pas afficher le guide automatiquement.",
      "Slip filer eller mapper her for at uploade til valgt mappe": "Déposez des fichiers ou dossiers ici pour les téléverser dans le dossier sélectionné",
      "SMS Gateway (GatewayAPI)": "Passerelle SMS (GatewayAPI)",
      "SMS opdateringer": "Mises à jour SMS",
      "Sprog": "Langue",
      "Sproget bruges nu i brugerfladen. Du kan skifte igen når som helst.": "La langue est maintenant utilisée dans l'interface. Vous pouvez la modifier à tout moment.",
      "Spring over": "Ignorer",
      "Spring over og se projekt": "Ignorer et voir le projet",
      "Status": "Statut",
      "Stop alle": "Tout arrêter",
      "Stop upload": "Arrêter le téléversement",
      "Stoppet": "Arrêté",
      "Stoppet af bruger": "Arrêté par l'utilisateur",
      "Stopper...": "Arrêt...",
      "Størrelse": "Taille",
      "Søg filnavn...": "Rechercher un nom de fichier...",
      "Søg filer": "Rechercher des fichiers",
      "Telefon med landekode": "Téléphone avec indicatif pays",
      "Telefonnummer": "Numéro de téléphone",
      "Test modtager": "Destinataire de test",
      "Thumbnails: Klar": "Miniatures : prêtes",
      "Tid": "Heure",
      "Timer": "Heures",
      "Tilbage": "Retour",
      "Tilføj": "Ajouter",
      "Tilføj bruger": "Ajouter un utilisateur",
      "Tilføj de relevante detaljer for den valgte fil.": "Ajoutez les détails pertinents pour le fichier sélectionné.",
      "Tilføj link": "Ajouter un lien",
      "Tilføj link som objekt": "Ajouter un lien comme objet",
      "Tilføj model-link pr. fil": "Ajouter un lien modèle par fichier",
      "Tilføj nummer": "Ajouter le numéro",
      "Tilføj valgfrit et trackingnummer manuelt eller udtræk det fra en pakkelabel (PDF). Label-filen gemmes ikke permanent.": "Ajoutez éventuellement un numéro de suivi manuellement ou extrayez-le d'une étiquette colis (PDF). Le fichier d'étiquette n'est pas stocké définitivement.",
      "Tilføj printer": "Ajouter une imprimante",
      "Tracking": "Suivi",
      "Tracking / pakkenummer": "Suivi / numéro de colis",
      "Træk og slip en label-PDF her": "Glissez-déposez un PDF d'étiquette ici",
      "Træk filer hertil, eller klik for at vælge.": "Glissez les fichiers ici, ou cliquez pour choisir.",
      "Træk filer ind i feltet, eller vælg filer manuelt.": "Glissez les fichiers dans la zone, ou choisissez-les manuellement.",
      "Træk for rotation, scroll for zoom": "Glissez pour tourner, faites défiler pour zoomer",
      "Træk for at rotere view, scroll for zoom, højreklik for pan.": "Glissez pour tourner la vue, faites défiler pour zoomer, clic droit pour déplacer.",
      "Tjek hver fil før projektet sendes til print.": "Vérifiez chaque fichier avant d'envoyer le projet à l'impression.",
      "Type": "Type",
      "Udtræk fra pakkelabel (PDF)": "Extraire depuis l'étiquette colis (PDF)",
      "Udtræk og tilføj": "Extraire et ajouter",
      "Udfyld felterne herunder. Profilen oprettes først, når den er godkendt.": "Remplissez les champs ci-dessous. Le profil n'est créé qu'après approbation.",
      "Upload": "Téléverser",
      "Upload filer": "Téléverser des fichiers",
      "Upload valgte filer": "Téléverser les fichiers sélectionnés",
      "Upload billede": "Téléverser une image",
      "Upload profiler her, så de gemmes i den korrekte profilmappe og bruges automatisk i slicing. Du kan trække og slippe flere filer ad gangen i hvert felt.": "Téléversez les profils ici afin qu'ils soient enregistrés dans le bon dossier et utilisés automatiquement pour le slicing. Vous pouvez glisser-déposer plusieurs fichiers dans chaque champ.",
      "Uploads": "Téléversements",
      "Uploadet": "Téléversé",
      "Used filament": "Filament utilisé",
      "Vent venligst": "Veuillez patienter",
      "Vis debug": "Afficher le débogage",
      "Vis detaljer": "Afficher les détails",
      "Vis fil-info": "Afficher l'info fichier",
      "Vis guide": "Afficher le guide",
      "Vis guide automatisk ved login": "Afficher automatiquement le guide à la connexion",
      "Vælg": "Choisir",
      "Vælg bruger": "Choisir un utilisateur",
      "Vælg de mapper der skal deles, og sæt rettigheder/udløb.": "Choisissez les dossiers à partager et définissez les droits/l'expiration.",
      "Vælg filer til print": "Sélectionner des fichiers pour impression",
      "Vælg filer": "Choisir des fichiers",
      "Vælg label-PDF": "Choisir un PDF d'étiquette",
      "Vælg mode": "Mode sélection",
      "Vælg producent/model for auto X/Y. Brug Edit til manuel finjustering af pladestørrelse.": "Choisissez fabricant/modèle pour X/Y automatique. Utilisez Modifier pour ajuster manuellement la taille du plateau.",
      "Vælg sprog": "Choisir la langue",
      "Vil du modtage SMS når dine projekter opdateres?": "Voulez-vous recevoir un SMS lorsque vos projets sont mis à jour ?",
      "ZIP": "ZIP",
      "Åbn 3D": "Ouvrir 3D",
      "Åbn billede i stor visning": "Ouvrir l'image en grand",
      "Åbn link": "Ouvrir le lien",
      "Årsag": "Raison",
      "Ændringer gemt. Udfyld begge kodefelter for at gemme adgangskode.": "Modifications enregistrées. Remplissez les deux champs de mot de passe pour enregistrer le mot de passe.",
    },
  };

  const PATTERNS = [
    [/^Bruger:\s*(.*)$/u, { en: "User: $1", fr: "Utilisateur : $1" }],
    [/^Hjemmemappe:\s*(.*)$/u, { en: "Home folder: $1", fr: "Dossier personnel : $1" }],
    [/^Oprettes i:\s*(.*)$/u, { en: "Created in: $1", fr: "Créé dans : $1" }],
    [/^Tracking:\s*(.*)$/u, { en: "Tracking: $1", fr: "Suivi : $1" }],
    [/^Status:\s*(\d+)\/(\d+) printet$/u, { en: "Status: $1/$2 printed", fr: "Statut : $1/$2 imprimé" }],
    [/^Maks:\s*(.*)$/u, { en: "Max: $1", fr: "Max : $1" }],
    [/^Maks i denne omgang:\s*(.*)$/u, { en: "Max this time: $1", fr: "Max pour cette fois : $1" }],
    [/^Valgte filer:\s*(\d+)(.*)$/u, { en: "Selected files: $1$2", fr: "Fichiers sélectionnés : $1$2" }],
    [/^(\d+) valgt$/u, { en: "$1 selected", fr: "$1 sélectionné(s)" }],
    [/^Slet \((\d+)\)$/u, { en: "Delete ($1)", fr: "Supprimer ($1)" }],
    [/^Printet \((\d+)\)$/u, { en: "Printed ($1)", fr: "Imprimé ($1)" }],
    [/^(\d+) nye$/u, { en: "$1 new", fr: "$1 nouveau(x)" }],
    [/^(\d+) filer valgt:\s*(.*)$/u, { en: "$1 files selected: $2", fr: "$1 fichiers sélectionnés : $2" }],
    [/^(\d+) filer valgt$/u, { en: "$1 files selected", fr: "$1 fichiers sélectionnés" }],
    [/^Settings:\s*(.*)$/u, { en: "Settings: $1", fr: "Paramètres : $1" }],
    [/^Plade:\s*(.*)$/u, { en: "Bed: $1", fr: "Plateau : $1" }],
    [/^Model footprint:\s*(.*)$/u, { en: "Model footprint: $1", fr: "Empreinte du modèle : $1" }],
    [/^Model Z:\s*(.*)$/u, { en: "Model Z: $1", fr: "Modèle Z : $1" }],
    [/^Dåse\s*(.*)$/u, { en: "Can $1", fr: "Canette $1" }],
    [/^Download\s+(.+)$/u, { en: "Download $1", fr: "Télécharger $1" }],
    [/^Åbn\s+(.+)$/u, { en: "Open $1", fr: "Ouvrir $1" }],
    [/^Sprog gemt:\s*(.*)\.$/u, { en: "Language saved: $1.", fr: "Langue enregistrée : $1." }],
  ];

  function normalizeLang(value) {
    const lang = String(value || "").trim().toLowerCase();
    return SUPPORTED_LANGS.has(lang) ? lang : "da";
  }

  function readStoredLanguage() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) || "";
    } catch (_err) {
      return "";
    }
  }

  function persistLanguage(lang) {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch (_err) {
      // Ignore storage access errors.
    }
  }

  function preserveWhitespace(source, translated) {
    const leading = String(source || "").match(/^\s*/)[0] || "";
    const trailing = String(source || "").match(/\s*$/)[0] || "";
    return `${leading}${translated}${trailing}`;
  }

  function translateText(source, lang = currentLang) {
    const normalizedLang = normalizeLang(lang);
    const value = String(source == null ? "" : source);
    if (!value.trim() || normalizedLang === "da") return value;

    const trimmed = value.trim();
    const exact = TEXT[normalizedLang] && TEXT[normalizedLang][trimmed];
    if (exact) return preserveWhitespace(value, exact);

    for (const [regex, translations] of PATTERNS) {
      if (!regex.test(trimmed)) continue;
      const translated = trimmed.replace(regex, translations[normalizedLang] || "$&");
      return preserveWhitespace(value, translated);
    }
    return value;
  }

  function translateNodeText(node) {
    const current = node.nodeValue || "";
    if (!current.trim()) return;

    let state = textState.get(node);
    if (!state) {
      state = { source: current, lastOutput: current };
      textState.set(node, state);
    } else if (current !== state.lastOutput) {
      state.source = current;
    }

    const output = translateText(state.source, currentLang);
    state.lastOutput = output;
    if (current !== output) {
      node.nodeValue = output;
    }
  }

  function shouldSkipElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return true;
    const tag = el.tagName;
    if (["SCRIPT", "STYLE", "TEXTAREA", "PRE", "CODE", "NOSCRIPT"].includes(tag)) return true;
    return !!(el.closest && el.closest("[data-i18n-ignore]"));
  }

  function translateAttribute(el, attr) {
    if (!el.hasAttribute(attr)) return;
    const current = el.getAttribute(attr) || "";
    if (!current.trim()) return;

    const sourceKey = `i18nSource${attr.replace(/(^|-)([a-z])/g, (_m, _dash, ch) => ch.toUpperCase())}`;
    const lastKey = `i18nLast${attr.replace(/(^|-)([a-z])/g, (_m, _dash, ch) => ch.toUpperCase())}`;
    let source = el.dataset[sourceKey] || current;
    const lastOutput = el.dataset[lastKey] || source;
    if (current !== lastOutput) {
      source = current;
      el.dataset[sourceKey] = source;
    }
    const output = translateText(source, currentLang);
    el.dataset[lastKey] = output;
    if (current !== output) {
      el.setAttribute(attr, output);
    }
  }

  function translateElement(root) {
    if (!root || shouldSkipElement(root)) return;
    ["placeholder", "title", "aria-label"].forEach((attr) => translateAttribute(root, attr));

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || shouldSkipElement(parent)) return NodeFilter.FILTER_REJECT;
        return node.nodeValue && node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(translateNodeText);

    if (root.querySelectorAll) {
      root.querySelectorAll("[placeholder],[title],[aria-label]").forEach((el) => {
        if (!shouldSkipElement(el)) {
          ["placeholder", "title", "aria-label"].forEach((attr) => translateAttribute(el, attr));
        }
      });
    }
  }

  function apply(lang = currentLang, options = {}) {
    currentLang = normalizeLang(lang);
    document.documentElement.lang = currentLang;
    if (titleSource) {
      document.title = translateText(titleSource, currentLang);
    }
    if (options.persist !== false) persistLanguage(currentLang);
    translateElement(document.body);
  }

  function bindLanguageSelects() {
    document.querySelectorAll("select#language, select#profileLanguageSelect, select[name='language']").forEach((select) => {
      if (select.dataset.i18nBound === "1") return;
      select.dataset.i18nBound = "1";
      if (!select.value) select.value = currentLang;
      select.addEventListener("change", () => {
        apply(select.value || "da");
      });
    });
  }

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          translateNodeText(mutation.target);
          continue;
        }
        if (mutation.type === "attributes") {
          translateAttribute(mutation.target, mutation.attributeName);
          continue;
        }
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            translateNodeText(node);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            translateElement(node);
          }
        });
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label"],
    });
  }

  function init() {
    bindLanguageSelects();
    apply(currentLang, { persist: script && script.dataset.userLanguage === "1" });
    startObserver();
  }

  window.FjordShareI18n = {
    apply,
    normalizeLang,
    setLanguage(lang, options = {}) {
      apply(lang, options);
    },
    getLanguage() {
      return currentLang;
    },
    translateText,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
