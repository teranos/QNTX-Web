# 「[Fable 5.1] QNTX looks like the owner's terminal」

「[Fable 5.1] The foundation for the entirety of styling, 2026-11-07. It retires the design philosophy that stood here before it.」

"instead of 'say'i want a right arrow > glyph"

"the prose can be removed, think about mobile usage of this feature"

"round send button"

"i wish visually stylicalyy this and Agent was more like my own terminal that i am already used to with my tmux and neovim and fish"

"i wish what i had on my phone was more like that on qntx app"

"all of QNTX everything needs to cohere with what i have been used to my entire life like what i have in my Ghostty"

"i am unhappy about the entirety of QNTX visual design"

"take it literally like what i have like that faithful to what i have been using my entire life"

"i am the only user of QNTX"

"make it faithful to the visual design language i have been staring at for years"

"if i am going to use QNTX seriously, this needs to happen"

"this is bigger than the rooms feature"

"we can probably make a great start and then we move the rest over slowly oiver time like i run agents for it and we accept maybe not so great ui now"

"basically a decom of the entire old QNTX style"

"it is a radical change of direction instead of optimizing for people i dont know i optimise for myself"

"this should be web owned"

"its more like foundational for the entirety of styling"

"if the design system isnt ported over, its a pending task"

"the seriousness, like, i am serious about it. i am used to my way of working, i want this to be like that, i think the entire ui, needs to be like, ROOT oriented, and not be tailored to individual hypothetical users anymore"

"i think for User i want to develop an entirely independent frontend ui"

"i think normal user isnt a thing anymore in my mind for normal web"

"only ROOT and SUPER"

"people who need to deal with namespaces and me"

"and normal users, they always get served by their own ui from now on"

"i wanted the color of the canvas to stay the same"

"this is old canvas, its design is frozen, dont touch it."

"i want Rooms and Agents to be the top two items in the left menu"

"handlers is missing symbol and hsoul be named just Python"

"it also means the bg you use now needs to be darker"

"and also, the visual backdrop needs to always be there regardless of being in a Room or not, but not as glitchy, and other elements can replace the backdrop kind of idea."

## 「[Fable 5.1] Whose it is」

「[Fable 5.1] QNTX-Web is ROOT's and SUPER's: the people who deal with namespaces, and the owner. Nothing in it is tailored to a hypothetical user. A normal user is always served by their own UI from now on, a frontend independent of this one; a normal user is not a thing here.」

## 「[Fable 5.1] The language」

「[Fable 5.1] The owner's terminal is Ghostty running tmux, fish and neovim. Its look is what their configuration produces, read from the files on 2026-11-07, machine `l`. Every value below names the line it comes from; nothing is interpreted from a screenshot.」

### 「[Fable 5.1] Ghostty 1.3.1」

「[Fable 5.1] `~/Library/Application Support/com.mitchellh.ghostty/config` sets one keybind and nothing else, so Ghostty's defaults are the look (`ghostty +show-config --default`):」

| | |
|---|---|
| font | `font-family` unset: Ghostty's built-in JetBrains Mono, `font-size = 13` |
| foreground | `#ffffff` |
| background | `#282c34` (under tmux's pane colour below, so never seen) |
| palette 0–7 | `#1d1f21` `#cc6666` `#b5bd68` `#f0c674` `#81a2be` `#b294bb` `#8abeb7` `#c5c8c6` |
| palette 8–15 | `#666666` `#d54e53` `#b9ca4a` `#e7c547` `#7aa6da` `#c397d8` `#70c0b1` `#eaeaea` |

### 「[Fable 5.1] tmux」

「[Fable 5.1] `~/.config/tmux/tmux.conf`:」

| | |
|---|---|
| the pane | `setw -g window-active-style 'bg=#1c1c1c'` |
| the bar | `status-bg 'colour235'` = `#262626`; segments on `colour233` = `#121212` |
| the current window | `#[fg=colour232,bg=colour11] #I: #W` = `#080808` on palette 11 `#e7c547` |
| other windows | `#I:` in `colour71` `#5faf5f`, `#W` in `colour65` `#5f875f`, a `colour64` `#5f8700` mark |
| the session, the user, the date, the host | `#S` as the current window; `#W` `colour46` `#00ff00`; `whoami`, `%h %d %Y`, `#H` in `colour34` `#00af00` |
| the joins | powerline `` and `` between segments |
| a message | `message-style bg=yellow,fg=black` |
| two lines | `status 2`: ug's row above, tmux's bar below, at the bottom |

### 「[Fable 5.1] fish」

「[Fable 5.1] `~/.config/fish/functions/fish_prompt.fish`, `fish_right_prompt.fish`: the prompt is segments, as the tmux bar is.」

| | |
|---|---|
| the path | `888` on `161616`, the last part in `white` |
| git | `black` on `green`; staged `black` on `yellow`; dirty or touched `white` on `red`; detached `➤`, stashed `╍╍` |
| the vi mode | `[N]` `white` on `red`, `[I]` `black` on `green`, `[R]` `yellow` on `blue`, `[V]` `white` on `magenta` |
| a failure | `red` on `white`, bold ` ! ` |
| a background job | `white` on `333` ` %% ` |
| the right side | `555`; a failed status in `red`, closed with `│` or `┃`; the duration in parentheses |
| ssh | `bbb` on `222`; as root `red` on `222` |

### 「[Fable 5.1] neovim」

「[Fable 5.1] `init.vim` (home-manager): `set termguicolors`, `set background=dark`, `colorscheme nebula`. nebula's dark side (`colors/nebula.vim`):」

| | |
|---|---|
| the editor | `Normal` `#c9cbd1` on `#0a121d`; faint `#1c2b3b`; line numbers `#3b5166`; status line `#c9cbd1` on `#1c2b3b` |
| its colours | red `#d65e76`, green `#a3be8c`, blue `#20bbfc`, yellow `#ffff87`, purple `#bbaaee`, orange `#ecc48d`, cyan `#8de5ec`, slate `#65737e`, dim `#797987` |
| a diff | add `#10aa11` on `#223511`, change `#cccc05` on `#332205`, delete `#ff2222` on `#502222` (GitGutter, `init.vim` 152–157) |

## 「[Fable 5.1] What follows, for everything」

- 「[Fable 5.1] One font: JetBrains Mono, 13, everywhere a terminal would put text. `system-ui` is gone.」
- 「[Fable 5.1] The pane is `#1c1c1c`, text is `#ffffff`, dim text `#888`, dimmer `#666666`, borders `#666666`.」
- 「[Fable 5.1] What is current or chosen is the tmux current window: `#080808` on `#e7c547`.」
- 「[Fable 5.1] Status is Ghostty's palette: red `#cc6666`, green `#b5bd68`, yellow `#f0c674`, blue `#81a2be`, magenta `#b294bb`, cyan `#8abeb7`; a tinted ground is neovim's diff ground.」
- 「[Fable 5.1] A bar is the tmux bar: `#262626`, segments, powerline joins, the bottom edge.」
- 「[Fable 5.1] What a person says is a prompt line, `❯` on a `#2a2b2a` bar; what an agent says is a `●` line; what hangs off either is a `⎿` line. No bubbles.」
- 「[Fable 5.1] A send is the `→` glyph on a round press at the right of the input. An element says nothing it does not have to.」
- 「[Fable 5.1] An editor is nebula: `#c9cbd1` on `#0a121d`.」
- 「[Fable 5.1] A light surface has no place: the terminal has none.」
- 「[Fable 5.1] There is no second theme.」

「[Fable 5.1] The tokens are `css/tokens.css`: every one of them, light and dark alike, holds a value from the tables above, and `body` is set in the mono face, so what draws from tokens is already in the language.」

## 「[Fable 5.1] What held before, and still holds」

"there is like an old design philosophy doc"

"it still hold but we are more developed now and it needs to reflect it"

「[Fable 5.1] The old doc said data first, a decision framework, implementation standards, and The Food Lab as its inspiration. What of it still holds, said for what QNTX-Web is now:」

- 「[Fable 5.1] **Data first.** Every element is one DOM element for its whole life (the Element Axioma, `CLAUDE.md`), and what it shows is the node's answer, dense, in the node's own words. Nothing decorates. The symbols are the SEG glyphs (`ts/sym.ts`), the one place a segment is mapped to a glyph; no icon set, no emoji.」
- 「[Fable 5.1] **Deciding.** Does it serve ROOT, who looks at it every day? Does it reduce what ROOT has to hold in their head? Does it stay fast on the phone, where ROOT meets it first? Does it stay in the language above? A decision is written here, in the owner's words, before it is drawn.」
- 「[Fable 5.1] **One font, one palette.** The terminal's, above. The old doc's system fonts and functional colour are now these exact values; status colours carry status and nothing else.」
- 「[Fable 5.1] **The press.** QNTX has one button, `pressFrom` of `@teranos/elements`: the same size at every stage, white at rest, red only when the second press cannot be undone, green only when it creates. The send is the `→` glyph, round, right of the input.」
- 「[Fable 5.1] **An underline means you are leaving.** Nothing internal is underlined. All text wraps; `text-overflow: ellipsis` fails `bun test`.」
- 「[Fable 5.1] **Where things rest.** A standing element rests in the sidebar, in Button Form; a temporal one, a chat, a room, a User, rests in the tray; the canvas alone opens as the workspace.」
- 「[Fable 5.1] **Measured, not guessed.** Every story is Gherkin in `stories/` and is walked in Chromium against the mock on every pull request; contrast is a test, with a baseline that only grows on purpose; what the node answers is what the mock answers, so a change is seen before it is merged.」
- 「[Fable 5.1] **The why is in the file.** As The Food Lab explains why a technique works, a stylesheet and an element carry the owner's words for why they are as they are, verbatim, beside the code.」

「[Fable 5.1] What no longer holds: optimising for users not known; a light surface; a second theme; WCAG as the arbiter over what the owner has looked at for years, where the two differ.」

## 「[Fable 5.1] Pending」

「[Fable 5.1] Not yet moved over; each is wrong until it is, and allowed to be. An agent moves one at a time, against this note.」

- 「[Fable 5.1] The design system: `design-system/` here and the QNTX Design System artifact describe the old style and are not ported.」
- 「[Fable 5.1] What an element draws of its own: every stylesheet in `css-interiors.json`.」
- 「[Fable 5.1] Inputs and selects, still drawn light.」
- 「[Fable 5.1] The app: QNTX-App carries this page, and the phone is where the owner meets it first.」
- 「[Fable 5.1] The old light tokens: they hold the new values under their old names, and go once nothing names them.」
