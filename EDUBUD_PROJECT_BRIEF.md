# EduBud: project brief

The public brief: people by role, no money, no contacts. The meeting notes with names are in the private notes
(`docs/internal/EduBud/meetings/`, CLAUDE.md "Local files").

## EduBud

EduBud International is a nonprofit in Georgia: a **learning center for adults with disabilities** (an educational day
program and a summer program) and **volunteer projects** run by high school and college students. Its volunteers belong
to **community chapters**, one per high school, each with a student leadership team: about 7 chapters and 150
volunteers in 2026, and growing. Its website, **edubud.org**, was made on Squarespace by a designer EduBud hired.

| Who | What they do |
|---|---|
| The founder | Runs EduBud; HyberTec's contact. |
| The program director | Runs the programs; the founder decides money matters with them. |
| The central team | Reviews every chapter's records and keeps the main sheet. |
| Chapter leaders | Students who keep their chapter's records. |
| Volunteers | High school and college students; many are minors. |
| Participants and their families | The adults the learning center serves. Families call EduBud; they don't use the website much. |

## What EduBud asked for (the kickoff meeting, 2026-11-16)

EduBud likes its website and wants to **keep its design exactly**. HyberTec rebuilds it in its own code, look for look,
and adds what EduBud needs on top:

1. **A sign-in**, a button at the top right.
2. **A volunteer point tracker** in place of today's spreadsheets. A volunteer earns national membership and the
   year-end volunteer award with meeting requirements, community engagement points, social points, PR points and
   reward points (which turn into volunteer hours at the end of the year), plus their volunteer hours; each event adds
   points or hours. Today every chapter's leaders update their own sheet, and the central team checks each one and
   copies it into the main sheet by hand: slow, and easy to get wrong. Volunteers should see their own progress, and
   chapter leaders update their chapter's.
3. **One inbox for every interest form**: today each form is a different Google Form.
4. **An events calendar** the whole team can see.
5. **Editing the website's photos and text** from an admin page, without a developer.
6. **A phone app**, at the very end, once everything else is ready.

Not wanted: **parent accounts** or progress reports for participants' families.

## The order of work

1. **A copy of edubud.org, identical for visitors**, on our Firebase Hosting (`edubud-hybertec.web.app`), compared
   side by side with the original page by page at desktop, tablet and phone sizes. How: `docs/proposals/replica.md`.
2. Then, one by one, once the owner has compared the copy: the sign-in, the point tracker, the forms inbox, the
   calendar and the admin pages.
3. Moving edubud.org from Squarespace to our copy, when the owner and EduBud say so.
4. The phone app.

## What we have

- **EduBud's Squarespace site**, with admin access for HyberTec's project owner.
- **Their point tracker** (2026–27) and the Google Form volunteers use to ask for a correction, as copies, in the
  private notes (`docs/internal/EduBud/resources/`). They're real people's data: never in this repository.
- **The Firebase project** `edubud-hybertec`: Authentication (Google, and email and password), Firestore, Hosting.
