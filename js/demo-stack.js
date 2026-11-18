// STACKS — "The Haunted Stack": the built-in demo adventure.
// Pure data, built only with the model.js factories and the HyperTalk-lite
// language — everything here is something any user can build with the tool.
// Story map and design: .kiro/specs/haunted-stack-demo/design.md

import { createStack, createCard, createField, createButton } from "./model.js";

const STORY = { x: 40, y: 64, w: 640, h: 150, fontSize: 19 };
const NOTE = { x: 40, y: 240, w: 640, h: 70, fontSize: 17 };

function storyField(name, text) {
  return createField(name, { ...STORY, text });
}

function noteField(name, text = "") {
  const f = createField(name, { ...NOTE, text });
  f.hidden = true;
  return f;
}

// Buttons sit in a row near the bottom of the 720x480 card.
function buttonRow(name, slot, label, script) {
  return createButton(name, { x: 40 + slot * 220, y: 392, w: 200, h: 44, label, script });
}

function go(name) {
  return `on mouseUp\n  go to card "${name}"\nend mouseUp`;
}

export function buildDemoStack() {
  const stack = createStack("The Haunted Stack", "STACKS");
  stack.description =
    "Locked in Blackwood Manor at midnight. Find the brass key, light the tower candle, and escape before the house wakes. A complete adventure built with STACKS — every card and script is editable.";
  stack.cards = [];
  const add = (card) => {
    stack.cards.push(card);
    return card;
  };

  // 1 — Foyer
  const foyer = add(createCard("Foyer", "foyer"));
  foyer.onShow = 'on show\n  play sound "knock"\n  wait 1 second\n  play sound "knock"\nend show';
  foyer.fields.push(storyField(
    "Story",
    "Midnight. The great door of Blackwood Manor slams shut behind you — and locks itself. Rain hammers the windows. Somewhere above, a clock strikes thirteen. You need light, a key, and a way out.",
  ));
  foyer.buttons.push(
    buttonRow("To Library", 0, "Enter the Library", go("Library")),
    buttonRow("To Mirror", 1, "Mirror Room", go("Mirror Room")),
    buttonRow("Whisper", 2, "Follow the whisper", "on mouseUp\n  go to card 3\nend mouseUp"),
  );

  // 2 — Library
  const library = add(createCard("Library", "library"));
  library.fields.push(
    storyField(
      "Story",
      "Dusty shelves lean like tired giants. On the reading desk, something brass glints between two enormous books: a key, warm to the touch, as if someone held it a moment ago.",
    ),
    noteField("KeyNote"),
  );
  library.buttons.push(
    buttonRow(
      "Take Key", 0, "Take the brass key",
      'on mouseUp\n  set hasKey to 1\n  put "You pocket the brass key. It hums faintly, like a struck tuning fork." into field "KeyNote"\n  show field "KeyNote"\n  hide button "Take Key"\n  play sound "chime"\nend mouseUp',
    ),
    buttonRow("To Cellar", 1, "Down to the Cellar", go("Cellar")),
    buttonRow("To Attic", 2, "Up to the Attic", go("Attic")),
  );

  // 3 — Attic
  const attic = add(createCard("Attic", "attic"));
  attic.onShow = 'on show\n  play sound "whisper"\nend show';
  attic.fields.push(storyField(
    "Story",
    "The attic breathes dust. A rocking chair rocks itself, keeping time with a song only it can hear. Pinned to a beam, a poem in a child's hand: “The house keeps what the house is owed.”",
  ));
  attic.buttons.push(buttonRow("To Library", 0, "Back to the Library", go("Library")));

  // 4 — Cellar
  const cellar = add(createCard("Cellar", "cellar"));
  cellar.onShow = 'on show\n  play sound "thunder"\nend show';
  cellar.fields.push(storyField(
    "Story",
    "Stone steps spiral down into the dark. At the bottom: a small iron door, banded and bolted, with a keyhole shaped like a star.",
  ));
  cellar.buttons.push(
    buttonRow(
      "Try Door", 0, "Try the cellar door",
      'on mouseUp\n  if hasKey = 1 then\n    go to card "Kitchen"\n  end if\n  answer "Locked. The keyhole is shaped like a star — something brass-shaped would help."\nend mouseUp',
    ),
    buttonRow("To Library", 1, "Back to the Library", go("Library")),
  );

  // 5 — Kitchen
  const kitchen = add(createCard("Kitchen", "kitchen"));
  kitchen.fields.push(
    storyField(
      "Story",
      "The kitchen smells of rosemary and old smoke. On the sill sits a candle in a brass holder — and beside it, a box of matches, dry as bone.",
    ),
    noteField("CandleNote"),
  );
  kitchen.buttons.push(
    buttonRow(
      "Take Candle", 0, "Take the candle",
      'on mouseUp\n  set hasCandle to 1\n  put "You take the candle and the matches. A small flame against a very large dark." into field "CandleNote"\n  show field "CandleNote"\n  hide button "Take Candle"\n  play sound "chime"\nend mouseUp',
    ),
    buttonRow("To Garden", 1, "Out to the Garden", go("Garden")),
    buttonRow("To Tower", 2, "Up to the Tower", go("Tower")),
  );

  // 6 — Garden
  const garden = add(createCard("Garden", "garden"));
  garden.fields.push(
    storyField(
      "Story",
      "Moonlight spills across the overgrown garden. A stone sphinx guards the gate, its riddle carved in moss: “I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?”",
    ),
    noteField("SphinxAnswer", "“An echo,” you say. The sphinx nods, and the gate creaks open — but it only leads back inside. The way out is up."),
  );
  garden.buttons.push(
    buttonRow(
      "Answer Riddle", 0, "Answer: an echo",
      'on mouseUp\n  put " — An echo!" after field "Story"\n  show field "SphinxAnswer"\n  hide button "Answer Riddle"\n  play sound "chime"\nend mouseUp',
    ),
    buttonRow("Wander", 1, "Wander on", "on mouseUp\n  go to next card\nend mouseUp"),
    buttonRow("Give Up", 2, "Give up and sleep", go("Trapped")),
  );

  // 7 — Mirror Room
  const mirror = add(createCard("Mirror Room", "mirror"));
  mirror.onShow = 'on show\n  play sound "creak"\nend show';
  mirror.fields.push(
    storyField(
      "Story",
      "A tall mirror in a gilt frame. Your reflection arrives a half-second late — and it is smiling. You are not smiling.",
    ),
    noteField("Ghost", "The reflection leans closer and mouths three words: LIGHT. THE. TOWER."),
  );
  mirror.buttons.push(
    buttonRow(
      "Touch Mirror", 0, "Touch the mirror",
      'on mouseUp\n  show field "Ghost"\n  play sound "whisper"\nend mouseUp',
    ),
    buttonRow("To Foyer", 1, "Back to the Foyer", go("Foyer")),
    buttonRow("To Tower", 2, "Up to the Tower", go("Tower")),
  );

  // 8 — Tower
  const tower = add(createCard("Tower", "tower"));
  tower.onShow = 'on show\n  play sound "wind"\nend show';
  tower.fields.push(storyField(
    "Story",
    "Ninety-nine steps up, and the tower room: a round window, a brass lantern, and the whole sleeping town below. The lantern is unlit. The dark presses close.",
  ));
  tower.buttons.push(
    buttonRow(
      "Light Candle", 0, "Light the candle",
      'on mouseUp\n  if hasCandle = 1 then\n    go to card "Escape"\n  end if\n  answer "Too dark to climb the last steps — you need a light."\nend mouseUp',
    ),
    buttonRow("To Kitchen", 1, "Back to the Kitchen", go("Kitchen")),
  );

  // 9 — Escape (good ending)
  const escape = add(createCard("Escape", "dawn"));
  escape.onShow = 'on show\n  play sound "chime"\nend show';
  escape.fields.push(storyField(
    "Story",
    "The candle catches. The lantern blazes — and the whole manor exhales, like a held breath released. Dawn spills through the window. The front door stands open, and the garden path leads home. You made it out.",
  ));
  escape.buttons.push(buttonRow("Play Again", 0, "Play again", "on mouseUp\n  go to first card\nend mouseUp"));

  // 10 — Trapped (bad ending)
  const trapped = add(createCard("Trapped", "dark"));
  trapped.fields.push(storyField(
    "Story",
    "You sleep under the moon, and the garden grows over you — gently, the way the house keeps everything it loves. When you wake, the manor is quiet. The door is still locked. But every night is a new chance.",
  ));
  trapped.buttons.push(buttonRow("Try Again", 0, "Try again", "on mouseUp\n  go to first card\nend mouseUp"));

  stack.firstCardId = foyer.id;
  return stack;
}

export const DEMO_STACK_ID = "demo-haunted-stack";

export function getDemoStack() {
  const stack = buildDemoStack();
  stack.id = DEMO_STACK_ID;
  return stack;
}
