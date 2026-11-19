# Open questions

Everything still waiting for an answer, in one place. Answers move to [`DECISIONS.md`](DECISIONS.md) with the date,
and the question leaves this page. Until then the project uses the default named next to each question.

## For the owner

The copy of the website is built to match edubud.org. The questions below are where it can't match, or where the
original does something that looks like a fault and we didn't copy the fault. Each has the default in use until you
answer.

### Q6. Where the copy can't be the same without something from EduBud

- **The animated backgrounds** (about 33 sections: the moving gradients, waves and patterns) are Squarespace's own
  programs, drawn live in the browser. The copy shows a still picture of each, taken from the original at phone,
  tablet and computer widths. The pause button is there and switches its icon, but there's nothing to pause.
  *Default: still pictures.* Making them move would mean writing our own versions of those effects. Say if you want
  that.
- **The map** (Day Learning Program) is Google's free embed. Without EduBud's own Google Maps key it can't be drawn
  exactly like the original's: it adds a satellite thumbnail and a full-screen button, puts Google's logo in the
  middle, and the mouse wheel scrolls the page instead of zooming. *Default: the free embed.* A key (free for this
  use) would make it the same; it would be EduBud's or HyberTec's Google account.
- **The Instagram feed** (Our Team) shows the posts Squarespace had copied when we read the site (20 posts). New posts
  won't appear until the copy reads them again. *Default: a snapshot, refreshed by hand* (`scripts/capture/widgets.ts`).
  Keeping it live needs EduBud's Instagram account connected to our app, later.
- **Search:** the "page not found" page's second link ("try searching … clicking here") opens Squarespace's search
  page on the original. The copy has no search yet, so it shows "page not found" again. *Default: left as is*; a
  search page would be new work.

### Q7. Faults on the original we didn't copy, and small differences

The rule is "the copy, not a redesign", so these are written down rather than changed quietly. The first two are the
original misbehaving under some condition, not a design choice; the last is a passing difference while the window is
being resized.

- **Pictures in galleries that stay blank:** on the original, scrolling fast past a gallery can leave some of its
  pictures empty until you scroll back. Ours always draws them.
- **Animations skipped on a slow load:** the four blocks that animate into view on the original (all on Day Learning
  Program) skip their animation and simply appear if the page took more than two seconds to start. Ours always
  animate.
- **Galleries while the window is resized** re-arrange at once on ours; the original waits 0.175 seconds.

*Default: as ours does now.* Say if you'd rather copy any of them too.

## For EduBud

Nothing yet. Questions for EduBud are numbered (E1, E2, …) so their answers can be matched; the message itself, with
names, lives in the private notes.
