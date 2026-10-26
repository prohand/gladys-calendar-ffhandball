# FFHandball Calendar

Esta integración pone los partidos de sus equipos de balonmano en el **calendario de Gladys**,
desde **ffhandball.fr**, el sitio web de la federación francesa de balonmano: ligas
profesionales, campeonatos nacionales, regionales y departamentales. Cada equipo se convierte
en un calendario, con cada partido programado, su pabellón, su enlace y, una vez jugado, su
resultado.

Sin cuenta ni clave: la integración lee el sitio web público, por internet.

Requiere **Gladys 5.3.0 o posterior**.

Esta integración solo hace el calendario. Para la clasificación, los resultados al momento, los
disparadores de escena propios y los widgets, instale también la integración **FFHandball**:
las dos funcionan juntas, con las mismas direcciones de equipo.

## Añadir sus equipos

1. En [www.ffhandball.fr/competitions](https://www.ffhandball.fr/competitions/), elija la
   temporada, la competición y haga clic en su equipo (en el calendario o en la clasificación).
2. Copie la dirección de esa página desde su navegador. Termina en `/equipe-<número>/`, por
   ejemplo:

   ```
   https://www.ffhandball.fr/competitions/saison-2026-2027-22/national/daikin-starligue-2026-27-32372/equipe-2119699/
   ```

3. En Gladys, abra la página de la integración. En el bloque **Mis calendarios**, pegue la
   dirección en **Equipos**, varios equipos separados por comas, y active.

Cada miembro del hogar activa la integración para sí mismo y elige sus propios equipos: los
calendarios son suyos. Empiezan siendo **privados**: comparta uno, en el mismo bloque, para que
el hogar lo vea y las escenas puedan usarlo.

**¿No encuentra la página del equipo?** Copie en su lugar la dirección de la competición (o de
uno de sus grupos) y péguela en el botón **Listar los equipos de una competición**: la
respuesta lista cada equipo con la dirección que hay que pegar.

**Nueva temporada, nuevas direcciones.** La federación da a cada equipo una nueva página cada
temporada: en septiembre, sustituya la dirección. El calendario antiguo se borra y se crea uno
nuevo para la temporada.

## Configuración

| Campo                                    | Función                                                                                                                     |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Equipos** (Mis calendarios)            | Direcciones de páginas de equipo, separadas por comas (o espacios). Una lista por usuario.                                  |
| **Intervalo de actualización (minutos)** | Minutos entre dos lecturas de ffhandball.fr, para todos los calendarios (60 por defecto, 15 como mínimo, 1440 como máximo). |

**Sincronizar ahora** lee al momento cada equipo de cada usuario e indica, equipo por equipo,
cuántos partidos hay en el calendario — o por qué ha fallado.

## Qué va al calendario

| Elemento        | Contenido                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------- |
| Calendario      | Uno por equipo, con el nombre del equipo y de su competición, con su color                    |
| Evento          | Uno por partido programado, p. ej. «CAEN HANDBALL – PARIS SAINT-GERMAIN»                      |
| Tras el partido | El resultado en el nombre, p. ej. «CAEN HANDBALL 29 – 32 PARIS SAINT-GERMAIN», y el desenlace |
| Horario         | El inicio, durante 1 h 30                                                                     |
| Lugar           | El pabellón y su dirección, tal como los publica el club                                      |
| Descripción     | La competición, la jornada, en casa o fuera, el resultado                                     |
| Enlace          | La página del partido en ffhandball.fr                                                        |

Un partido **sin fecha** no aparece: llega al calendario en cuanto la federación lo programa.
Un partido **reprogramado** se mueve, un partido que pierde su fecha se retira.

Los textos están en el idioma del usuario en Gladys. Las horas son las que publica la
federación (hora francesa).

## En las escenas

Los partidos son eventos de calendario como los demás: el disparador de calendario de Gladys
(un evento se acerca) y sus acciones de calendario los ven, una vez **compartido** el
calendario. Por ejemplo:

- una hora antes de un partido en casa, recordar a todos que salgan hacia el pabellón;
- la mañana de un partido, enviar el nombre y el lugar del evento.

## Solución de problemas

- **«no es una página de equipo»**: la dirección debe contener `/equipe-<número>/`. Use el
  botón **Listar los equipos de una competición** para obtenerla.
- **«team … not found on ffhandball.fr»**: la temporada de esa página ha terminado o el equipo
  se ha retirado. Pegue la dirección de la temporada en curso.
- **«ffhandball.fr unreachable»**: el sitio o su conexión a internet no funciona; el calendario
  conserva sus partidos y la integración vuelve a intentarlo en la próxima actualización.
- **Sin lugar**: el club no tiene calendario publicado en ffhandball.fr para esa competición;
  los partidos están, sin pabellón.
- **Un calendario ya no se actualiza**: quizá su sincronización esté desactivada en **Mis
  calendarios**.

## Privacidad

La integración solo lee páginas públicas de ffhandball.fr. No envía nada sobre usted ni sobre
su casa, no escribe ningún archivo y solo sincroniza a los usuarios que la han activado.
