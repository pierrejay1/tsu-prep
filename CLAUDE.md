\# TSU\! Prep — Context for Claude CLI

\#\# Project  
Site web de préparation TOEFL personnalisée. Live sur \*\*tsu-prep.com\*\*.  
\- Pack Smart : R$30 — plan par email  
\- Pack Smart Premium : R$70 — plan \+ session 45min Calendly

\#\# Stack  
| Service | Detail |  
|---|---|  
| GitHub | \`pierrejay1/tsu-prep\` (public, branche \`main\`) |  
| Netlify | Hébergement \+ déploiement auto sur push. URL: \`cozy-churros-a834c5\` |  
| Stripe | Smart: \`buy.stripe.com/14A5kEdc22VCcnicqudIA00\` / Premium: \`buy.stripe.com/aFa8wQ1tkgMsevq2PUdIA01\` |  
| Calendly | \`calendly.com/jaypierrelouis-pro/30min\` — embed dans form Premium |  
| Google Sheets | Sheet ID: \`1LWFAcYfdTO0IOQM1nrT5u7S4\_Kbnk5qwL\_ICiFOnLmg\` / Onglet: \`Feuille 1\` / SA: \`tsu-submit@tsu-prep.iam.gserviceaccount.com\` |  
| Netlify Env Vars | \`GOOGLE\_SERVICE\_ACCOUNT\_EMAIL\`, \`GOOGLE\_PRIVATE\_KEY\`, \`GOOGLE\_SHEET\_ID\` |

\#\# Repo structure  
\`\`\`  
tsu-prep/  
├── index.html          \# SPA bilingue PT/EN — Hero/Why/Method/Pricing/About \+ pages Onboarding \+ Paywall (display:none)  
├── sucesso.html        \# Page post-paiement (même palette, bilingue, checkmark SVG animé)  
├── intermediaire.html  \# Page de prep niveau Intermédiaire (voir section dédiée)  
├── termos.html         \# CGU bilingue PT/EN  
├── netlify.toml  
└── netlify/functions/submit.js  \# Serverless: JWT RS256 maison → Google Sheets. Toujours retourne {ok:true}  
\`\`\`

\#\#Dossier project (dossier local pour où sont tous les fichiers du projet et où tourne Claude CLI)  
\`CLAUDE.md\`  
\`CLAUDE\_matching.md\`  
\`Index.html\`  
\`sucesso.html\`  
\`termos.html\`  
\`submit.js\`  
\`Conteudo TSU\!.docx\`  
\`intermediaire.html\`

\#\# User flow  
\`index.html\` → clic pack → Onboarding form → submit → Paywall → Stripe → \`sucesso.html\`

\#\# Onboarding form — champs  
\*\*Obligatoires:\*\* Nome, Idade, Email, Anos falando inglês, Nível atual, Score mínimo, Finalidade, Prazo, Horas/dia, Como nos conheceu  
\*\*Optionnels:\*\* Gênero, Telefone, Pontos fortes, Pontos fracos, Hobby, Algo que não gosta  
\*\*Injecté par JS:\*\* \`Plano\` (Smart / Smart Premium)

\---

\#\# intermediaire.html — prêt État actuel  
Page de prep TOEFL niveau Intermédiaire. 4 onglets : \*\*Overview / Strategy / Exercises / Mock Test\*\*.

\#\#\# Mock Test  
\- Exercices affichés un par un avec bouton "Continue"  
\- \*\*Mode section par section\*\* : score après chaque section  
\- \*\*Mode test complet\*\* : score uniquement à la fin

\#\#\# Composition Mock Test Intermédiaire  
| Section | Exercices |  
|---|---|  
| Reading | 5 CTW \+ 4 Read in Daily Life \+ 2 Academic Passage |  
| Listening | 6 Listen and Choose \+ 5 Conversations \+ 3 Announcements \+ 2 Academic Talks |  
| Writing | 7 Build a Sentence \+ 1 Write an Email \+ 1 Academic Discussion |  
| Speaking | 1 Listen and Repeat \+ 1 Interview (4 questions) |

Audio : \*\*Web Speech API\*\* (pas de dépendance externe)

\---

\#\# Email  
Deux mails ([contact@tsu-prep.com](mailto:contact@tsu-prep.com)/assistant@tsu-prep.com) résolu  
Envoi automatique des plans prévu via \*\*Resend\*\* (plan gratuit) dans une Netlify Function.   
API Key ajoutée aux variables netlify \`RESEND\_API\_KEY\`.

\#\# Architecture prochaine étape — Pages de prep  
Besoin trouver un moyen pour algorithme envoyer page à l’email client APRÈS confirmation paiement sur stripe et surtout pas lors de la complétion du formulaire.  
\*\*Algo de matching\*\* (dans \`submit.js\`) : analyse Nível \+ Score visé \+ Prazo \+ Horas/dia → assigne une page.  
Matrice de matching définie par Pierre (dans \`CLAUDE\_matching.md\`).  
5 pages HTML statiques dans \`/preps/\` (Débutant / Débutant Avancé / Intermédiaire / Intermédiaire Constant / Intermédiaire Avancé / Avancé).  
URLs publiques mais non listées, envoyées par email uniquement après paiement.

\#\# Notes techniques  
\- Netlify logs fonctions : Logs & metrics \> Functions \> submit (éviter la vue Projects)  
\- \`submit.js\` : JWT RS256 natif Node.js, zéro dépendance externe  
