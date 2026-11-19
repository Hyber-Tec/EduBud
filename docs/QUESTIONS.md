# Open questions

Everything still waiting for an answer, in one place. Answers move to [`DECISIONS.md`](DECISIONS.md) with the date,
and the question leaves this page. Until then the project uses the default named next to each question.

## For the owner

The replica proposal's questions ([`proposals/replica.md`](proposals/replica.md) §7), asked 2026-11-18.

| | Question | Until answered |
|---|---|---|
| **Q1** | **Korean:** the original's picker shows 한국어 but does nothing (its translation service is out of words). A real Korean version (translated once, checked by a Korean reader, at `/ko/…`), no Korean, or the picker as today? | As today: the picker shows, nothing happens |
| **Q2** | **The shop:** Squarespace's checkout leaves with Squarespace. Copy it with its cart (checkout through EduBud's own Stripe account when the site moves), keep it as a catalogue, or drop it? | Copied with its cart; checkout goes nowhere yet |
| **Q3** | **Donations** are live on Squarespace. Stripe (EduBud's account) with our form drawn like today's, a nonprofit service's form (Zeffy, Givebutter), or PayPal? | The form is copied; paying isn't connected yet |
| **Q4** | **The forms** (contact, newsletter): look and thank like today but store nothing until the forms inbox, or store answers in Firestore from step 1? | They store nothing until the inbox |
| **Q5** | **EduBud's photos and videos** in Cloud Storage, out of this public repository? (Needs Storage turned on.) | Yes |

## For EduBud

Numbered so their answers can be matched; the message itself, with names, lives in the private notes.

| | Question | Needed for | Until answered |
|---|---|---|---|
| **E1** | Please tell us before changing the Squarespace site while the copy is being built (or keep changes for after). | Keeping the copy identical | The capture runs again before the copy is shown |
