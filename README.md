<!-- Improved compatibility of back to top link: See: https://github.com/othneildrew/Best-README-Template/pull/73 -->
<a name="readme-top"></a>

<div align="center">
  <a href="https://github.com/bibixx/workoutkit">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/bibixx/workoutkit/main/.github/readme/logo-dark.svg">
      <img src="https://raw.githubusercontent.com/bibixx/workoutkit/main/.github/readme/logo-light.svg" alt="workoutkit" width="160">
    </picture>
  </a>

<h3 align="center">workoutkit</h3>

  <p align="center">
    TypeScript SDK for reading and writing Apple's <code>.workout</code> file format
    <br />
    <br />
    <a href="https://github.com/bibixx/workoutkit/issues">Report Bug</a>
    ·
    <a href="https://github.com/bibixx/workoutkit/issues">Request Feature</a>
  </p>
</div>



<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li>
      <a href="#usage">Usage</a>
      <ul>
        <li><a href="#build-a-custom-workout">Build a custom workout</a></li>
        <li><a href="#encode-to-bytes">Encode to bytes</a></li>
        <li><a href="#decode-a-workout-file">Decode a .workout file</a></li>
        <li><a href="#workout-variants">Workout variants</a></li>
        <li><a href="#goals">Goals</a></li>
        <li><a href="#json-interop">JSON interop</a></li>
        <li><a href="#platform-recipes">Platform recipes</a></li>
      </ul>
    </li>
    <li><a href="#api-entries">API entries</a></li>
    <li><a href="#runtime-support">Runtime support</a></li>
    <li><a href="#compatibility">Compatibility</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#disclaimer">Disclaimer</a></li>
  </ol>
</details>



<!-- ABOUT THE PROJECT -->
## About The Project

`@bibixx/workoutkit` reads and writes the binary `.workout` files produced by Apple's Workout app on iOS 17+ and watchOS 10+. Those are the same bytes you get when you tap **Share Workout** on your Apple Watch or iPhone, or when a `WorkoutKit.WorkoutPlan` is encoded through `Transferable` for the share sheet.

This is a pure file-format SDK. It doesn't talk to HealthKit, it doesn't read or write workout history, and it doesn't call any Apple APIs. You don't need an Apple Developer account to use it.

What you do get:
* A fluent TS class API (`WorkoutPlan`, `CustomWorkout`, `Goal`, ...) for building workouts in memory.
* `encode(plan)` returning a `Uint8Array` of the exact bytes Apple's runtime produces.
* `decode(bytes)` returning a structured `WorkoutPlan`.
* JSON round-trip with `toJSON()` / `fromJson()` for storage and diffing.
* Zero runtime dependencies. Runs in Node, Bun, Deno, and the browser.

> This SDK is built by reverse engineering Apple's binary format. There's no public spec, so Apple can change the format whenever they want. See the [Compatibility section](#compatibility) for details.

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- GETTING STARTED -->
## Getting Started

### Prerequisites

| Name | Earliest tested version |
|------|------------------------:|
| Node | 18.0                    |

### Installation

```bash
npm install @bibixx/workoutkit
# or
pnpm add @bibixx/workoutkit
# or
yarn add @bibixx/workoutkit
# or
bun add @bibixx/workoutkit
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- USAGE EXAMPLES -->
## Usage

### Build a custom workout

```ts
import {
  WorkoutPlan, Step,
  Distance, Duration,
  DistanceGoal, TimeGoal,
} from "@bibixx/workoutkit";

const plan = new WorkoutPlan({ referenceId: crypto.randomUUID() });

const custom = plan.asCustom({
  activity: "running",
  location: "outdoor",
  displayName: "Tempo intervals",
});

// 5-minute warmup
custom.warmup = new Step(new TimeGoal(new Duration(5, "minutes")));

// 4× (1 km work + 2 min recovery)
const block = custom.addBlock(4);
block.addStep("work",     new DistanceGoal(new Distance(1, "kilometers")));
block.addStep("recovery", new TimeGoal(new Duration(2, "minutes")));

// 5-minute cooldown
custom.cooldown = new Step(new TimeGoal(new Duration(5, "minutes")));
```

### Encode to bytes

```ts
import { encode, toBlob, toBase64 } from "@bibixx/workoutkit/encode";

const bytes = encode(plan);   // Uint8Array with the exact .workout bytes
const blob  = toBlob(plan);   // Blob, application/octet-stream
const b64   = toBase64(plan); // base64 string
```

### Decode a .workout file

```ts
import { decode } from "@bibixx/workoutkit/decode";

const bytes = new Uint8Array(await (await fetch("/shared.workout")).arrayBuffer());
const plan  = decode(bytes);

console.log(plan.custom?.displayName);
```

### Workout variants

A `WorkoutPlan` wraps exactly one of four variants. This mirrors Apple's discriminated union. Switching variants (for example, calling `asGoal` after `asCustom`) clears the others, and that invariant is enforced at runtime.

```ts
const plan = new WorkoutPlan({ referenceId: crypto.randomUUID() });

// 1. Custom: warmup + blocks of work/recovery intervals + cooldown.
plan.asCustom({ activity: "running", location: "outdoor" });

// 2. Single-goal: one activity, one goal (time / distance / energy / open).
plan.asGoal({
  activity: "cycling",
  location: "outdoor",
  goal: new TimeGoal(new Duration(45, "minutes")),
});

// 3. Pacer: run or cycle a set distance in a set time.
plan.asPacer({
  activity: "running",
  location: "outdoor",
  distance: new Distance(5, "kilometers"),
  time:     new Duration(25, "minutes"),
});

// 4. SwimBikeRun: triathlon and brick workouts, any sequence of legs.
//    (Import SwimmingActivity / CyclingActivity / RunningActivity from the root.)
plan.asSwimBikeRun({ displayName: "Sprint tri" })
    .add(new SwimmingActivity({ swimmingLocation: "openWater" }))
    .add(new CyclingActivity({ location: "outdoor" }))
    .add(new RunningActivity({ location: "outdoor" }));
```

### Goals

Goals attach to steps (`Step.goal`) and to `SingleGoalWorkout`. The quantities (`Distance`, `Duration`, `Energy`) take the same units WorkoutKit does.

```ts
import {
  OpenGoal, TimeGoal, DistanceGoal, EnergyGoal, PoolSwimDistanceWithTimeGoal,
  Distance, Duration, Energy,
} from "@bibixx/workoutkit";

new OpenGoal();                                              // untimed
new TimeGoal(new Duration(30, "minutes"));
new DistanceGoal(new Distance(10, "kilometers"));
new EnergyGoal(new Energy(350, "kilocalories"));
new PoolSwimDistanceWithTimeGoal(
  new Distance(1500, "meters"),
  new Duration(30,   "minutes"),
);
```

Supported units:
* `LengthUnit`: `meters`, `kilometers`, `feet`, `yards`, `miles`
* `DurationUnit`: `seconds`, `minutes`, `hours`
* `EnergyUnit`: `kilocalories`, `kilojoules`

### JSON interop

Every class round-trips through a stable JSON shape. This is useful for storage, for diffing workouts, or for driving the SDK from a declarative spec.

```ts
import { WorkoutPlan } from "@bibixx/workoutkit";

const json = plan.toJSON();                  // WorkoutPlanJson
const copy = WorkoutPlan.fromJson(json);     // round-trips losslessly

// encode() / toBlob() / toBase64() also accept a WorkoutPlanJson directly,
// so you don't have to hydrate a class first.
```

### Platform recipes

Small runnable snippets for each entry on each runtime it supports. All of them assume `plan` is a `WorkoutPlan` built as in [Build a custom workout](#build-a-custom-workout).

#### Browser

Let the user download a `.workout` file.

```ts
import { toBlob } from "@bibixx/workoutkit/encode";

const url = URL.createObjectURL(toBlob(plan));
const a = Object.assign(document.createElement("a"), {
  href: url,
  download: "workout.workout",
});
a.click();
URL.revokeObjectURL(url);
```

Decode a file the user picked via `<input type="file">`.

```ts
import { decode } from "@bibixx/workoutkit/decode";

input.addEventListener("change", async () => {
  const file = input.files?.[0];
  if (!file) return;
  const plan = decode(new Uint8Array(await file.arrayBuffer()));
  console.log(plan.custom?.displayName);
});
```

POST a workout to your backend.

```ts
import { encode } from "@bibixx/workoutkit/encode";

await fetch("/api/workouts", {
  method: "POST",
  headers: { "content-type": "application/octet-stream" },
  body: encode(plan),
});
```

#### Node / Bun

Write a `.workout` file to disk with the `/fs` convenience wrappers.

```ts
import { saveWorkoutPlan, loadWorkoutPlan } from "@bibixx/workoutkit/fs";

await saveWorkoutPlan(plan, "./out.workout");
const roundTripped = await loadWorkoutPlan("./out.workout");
```

Or go through `/encode` + `/decode` directly — useful when you're streaming over HTTP without touching disk.

```ts
import { encode } from "@bibixx/workoutkit/encode";
import { decode } from "@bibixx/workoutkit/decode";
import { writeFile, readFile } from "node:fs/promises";

await writeFile("./out.workout", encode(plan));
const plan2 = decode(new Uint8Array(await readFile("./out.workout")));
```

#### Deno

`/fs` depends on `node:fs/promises`, so use `/encode` + `/decode` with Deno's own file APIs. Import via the `npm:` specifier.

```ts
import { encode } from "npm:@bibixx/workoutkit/encode";
import { decode } from "npm:@bibixx/workoutkit/decode";

await Deno.writeFile("./out.workout", encode(plan));
const plan2 = decode(await Deno.readFile("./out.workout"));
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>



## API entries

There are four subpath entries. Pick the smallest one you need, each one is independently tree-shakable.

| Entry                        | Exports                                                            | Use case                                                        |
|------------------------------|--------------------------------------------------------------------|-----------------------------------------------------------------|
| `@bibixx/workoutkit`         | All classes + types (`WorkoutPlan`, `CustomWorkout`, `Goal`, ...)  | Build workouts in memory                                        |
| `@bibixx/workoutkit/encode`  | `encode`, `toBlob`, `toBase64`                                     | Serialize to bytes. Browser / Node / Bun / Deno                 |
| `@bibixx/workoutkit/decode`  | `decode`                                                           | Parse `.workout` bytes. Browser / Node / Bun / Deno             |
| `@bibixx/workoutkit/fs`      | `saveWorkoutPlan`, `loadWorkoutPlan`                               | Convenience wrappers for local file IO. Node / Bun only (uses `node:fs/promises`) |

<p align="right">(<a href="#readme-top">back to top</a>)</p>



## Runtime support

| Runtime              | Supported | Notes                                                         |
|----------------------|-----------|---------------------------------------------------------------|
| Browsers (evergreen) | ✅         | Use `/encode` and `/decode`. `toBase64` uses `btoa`.          |
| Node 18+             | ✅         | All four entries. Use `/fs` for local file IO.                |
| Bun                  | ✅         | All four entries.                                             |
| Deno                 | ✅         | Use `/encode` and `/decode`. `/fs` requires Node-compat.      |

<p align="right">(<a href="#readme-top">back to top</a>)</p>



## Compatibility

This SDK is built by reverse engineering Apple's binary format. There's no public spec, so Apple can change the format whenever they want. The `majorVersion`, `minorVersion` and `privateVersion` fields in the file are the version gate.

Current coverage: iOS 26 / watchOS 26 / macOS 26 (as of 2026-04). If Apple ships a breaking change, expect an SDK update. See [`DEVELOPMENT.md`](DEVELOPMENT.md#schema-drift) for how drift is detected and patched.

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- ROADMAP -->
## Roadmap

Upcoming features and known issues are tracked using [GitHub issues](https://github.com/bibixx/workoutkit/issues).

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- CONTRIBUTING -->
## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

For development setup, byte-extraction tooling and the test suite layout, see [`DEVELOPMENT.md`](DEVELOPMENT.md).

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- LICENSE -->
## License

Distributed under the MIT License. See [`LICENSE`](./LICENSE) for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- CONTACT -->
## Contact

Bartek Legięć — [@bibix1999](https://twitter.com/bibix1999) — [legiec.io](https://legiec.io)

Project Link: [https://github.com/bibixx/workoutkit](https://github.com/bibixx/workoutkit)

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- DISCLAIMER -->
## Disclaimer

* This project is unofficial and is not associated in any way with Apple Inc. Apple, iOS, watchOS, WorkoutKit, HealthKit, Apple Watch, iPhone and related marks are trademarks of Apple Inc., registered in the U.S. and other countries.
* This SDK implements Apple's `.workout` file format through reverse engineering and clean-room analysis of publicly shipping binaries. It doesn't distribute any Apple code, assets or private APIs.

<p align="right">(<a href="#readme-top">back to top</a>)</p>
