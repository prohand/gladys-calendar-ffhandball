# FFHandball Calendar

Cette intégration met les matchs de vos équipes de handball dans le **calendrier de Gladys**,
depuis **ffhandball.fr**, le site de la Fédération Française de Handball : ligues
professionnelles, championnats nationaux, régionaux et départementaux. Chaque équipe devient un
calendrier, avec chaque match programmé, sa salle, son lien et, une fois joué, son score.

Pas de compte, pas de clé : l'intégration lit le site public, par internet.

Nécessite **Gladys 5.3.0 ou plus récent**.

Cette intégration ne fait que le calendrier. Pour le classement, les résultats en direct, les
déclencheurs de scène dédiés et les widgets, installez aussi l'intégration **FFHandball** : les
deux fonctionnent ensemble, avec les mêmes adresses d'équipe.

## Ajouter vos équipes

1. Sur [www.ffhandball.fr/competitions](https://www.ffhandball.fr/competitions/), choisissez la
   saison, la compétition, puis cliquez sur votre équipe (dans le calendrier ou le classement).
2. Copiez l'adresse de cette page dans votre navigateur. Elle finit par `/equipe-<numéro>/`,
   par exemple :

   ```
   https://www.ffhandball.fr/competitions/saison-2026-2027-22/national/daikin-starligue-2026-27-32372/equipe-2119699/
   ```

3. Dans Gladys, ouvrez la page de l'intégration. Dans le bloc **Mes calendriers**, collez
   l'adresse dans **Équipes**, une par ligne pour plusieurs équipes, puis activez.

Chaque membre du foyer active l'intégration pour lui-même et choisit ses propres équipes : les
calendriers sont à lui. Ils sont **privés** au départ : partagez-en un, dans le même bloc, pour
que le foyer le voie et que les scènes puissent l'utiliser.

**Vous ne trouvez pas la page de l'équipe ?** Copiez plutôt l'adresse de la compétition (ou
d'une de ses poules) et collez-la dans le bouton **Lister les équipes d'une compétition** : la
réponse liste chaque équipe avec l'adresse à coller.

**Nouvelle saison, nouvelles adresses.** La fédération donne une nouvelle page à chaque équipe
à chaque saison : en septembre, remplacez l'adresse. L'ancien calendrier est supprimé, un
nouveau est créé pour la saison.

## Configuration

| Champ                                        | Rôle                                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Équipes** (Mes calendriers)                | Adresses des pages équipe, une par ligne. Une par utilisateur.                                                     |
| **Intervalle de rafraîchissement (minutes)** | Minutes entre deux lectures de ffhandball.fr, pour tous les calendriers (60 par défaut, 15 minimum, 1440 maximum). |

**Synchroniser maintenant** lit tout de suite chaque équipe de chaque utilisateur et indique,
équipe par équipe, combien de matchs sont dans le calendrier — ou la raison de l'échec.

## Ce qui va dans le calendrier

| Élément        | Contenu                                                                                 |
| -------------- | --------------------------------------------------------------------------------------- |
| Calendrier     | Un par équipe, nommé d'après l'équipe et sa compétition, avec sa couleur                |
| Événement      | Un par match programmé, ex. « CAEN HANDBALL – PARIS SAINT-GERMAIN »                     |
| Après le match | Le score dans le nom, ex. « CAEN HANDBALL 29 – 32 PARIS SAINT-GERMAIN », et le résultat |
| Horaire        | Le coup d'envoi, pour 1 h 30                                                            |
| Lieu           | La salle et son adresse, telles que les publie le club                                  |
| Description    | La compétition, la journée, domicile ou extérieur, le résultat                          |
| Lien           | La page du match sur ffhandball.fr                                                      |

Un match **sans date** n'apparaît pas : il arrive dans le calendrier dès que la fédération le
programme. Un match **reprogrammé** est déplacé, un match qui perd sa date est retiré.

Les textes sont dans la langue de l'utilisateur dans Gladys. Les heures sont celles publiées par
la fédération (heure française).

## Dans les scènes

Les matchs sont des événements de calendrier comme les autres : le déclencheur de calendrier de
Gladys (un événement arrive) et ses actions de calendrier les voient, une fois le calendrier
**partagé**. Par exemple :

- une heure avant un match à domicile, rappeler à tout le monde de partir au gymnase ;
- le matin d'un match, envoyer le nom et le lieu de l'événement.

## En cas de problème

- **« pas une page équipe »** : l'adresse doit contenir `/equipe-<numéro>/`. Utilisez le
  bouton **Lister les équipes d'une compétition** pour l'obtenir.
- **« team … not found on ffhandball.fr »** : la saison de cette page est terminée, ou l'équipe
  a été retirée. Collez l'adresse de la saison en cours.
- **« ffhandball.fr unreachable »** : le site ou votre connexion internet est en panne ; le
  calendrier garde ses matchs et l'intégration réessaie au prochain rafraîchissement.
- **Pas de lieu** : le club n'a pas de calendrier publié sur ffhandball.fr pour cette
  compétition ; les matchs sont là, sans salle.
- **Un calendrier n'est plus mis à jour** : sa synchronisation est peut-être désactivée dans
  **Mes calendriers**.

## Vie privée

L'intégration ne lit que des pages publiques de ffhandball.fr. Elle n'envoie rien sur vous ni
sur votre maison, n'écrit aucun fichier, et ne synchronise que les utilisateurs qui l'ont
activée.
