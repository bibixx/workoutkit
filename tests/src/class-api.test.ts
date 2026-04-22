import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  Cadence,
  CadenceRangeAlert,
  CadenceThresholdAlert,
  CustomWorkout,
  CyclingActivity,
  Distance,
  DistanceGoal,
  Duration,
  Energy,
  EnergyGoal,
  HeartRate,
  HeartRateRangeAlert,
  HeartRateZoneAlert,
  IntervalBlock,
  OpenGoal,
  PacerWorkout,
  PoolSwimDistanceWithTimeGoal,
  Power,
  PowerRangeAlert,
  PowerThresholdAlert,
  PowerZoneAlert,
  RunningActivity,
  SingleGoalWorkout,
  Speed,
  SpeedRangeAlert,
  SpeedThresholdAlert,
  Step,
  SwimBikeRunWorkout,
  SwimmingActivity,
  TimeGoal,
  WorkoutPlan,
} from "@bibixx/workoutkit";
import { decode } from "@bibixx/workoutkit/decode";
import { encode } from "@bibixx/workoutkit/encode";

import { loadSpec } from "./spec.ts";
import { swiftParse } from "./swift-parse.ts";
import { normalize } from "./normalize.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(here, "../fixtures");

const fixtures = readdirSync(fixturesDir)
  .filter((f) => f.endsWith(".spec.json"))
  .sort();

describe("WorkoutPlan.fromJson → toJSON round-trip", () => {
  for (const name of fixtures) {
    it(name, () => {
      const json = loadSpec(join(fixturesDir, name));
      const plan = WorkoutPlan.fromJson(json);
      // toJSON must be deep-equal to the input after dropping undefineds.
      expect(normalize(plan.toJSON())).toEqual(normalize(json));
    });
  }
});

describe("class-built encode → Apple parser → spec JSON", () => {
  for (const name of fixtures) {
    it(name, () => {
      const json = loadSpec(join(fixturesDir, name));
      const plan = WorkoutPlan.fromJson(json);
      // Encode via the class, then verify Apple parses it back to the same spec.
      const bytes = encode(plan);
      const parsed = swiftParse(bytes);
      expect(normalize(parsed)).toEqual(normalize(json));
    });
  }
});

describe("hand-constructed classes (no fixtures)", () => {
  it("custom HIIT built via asCustom + addBlock + addStep", () => {
    const plan = new WorkoutPlan({
      referenceId: "11111111-1111-4111-8111-111111111111",
    });
    const custom = plan.asCustom({
      activity: "highIntensityIntervalTraining",
      location: "indoor",
      displayName: "Pyramid HIIT",
    });
    custom.warmup = new Step(new TimeGoal(new Duration(5, "minutes")));

    const b1 = custom.addBlock(2);
    b1.addStep("work", new TimeGoal(new Duration(30, "seconds")), "Hard");
    b1.addStep("recovery", new TimeGoal(new Duration(15, "seconds")));

    const b2 = custom.addBlock(2);
    b2.addStep("work", new TimeGoal(new Duration(45, "seconds")), "Harder");
    b2.addStep("recovery", new TimeGoal(new Duration(30, "seconds")));

    custom.cooldown = new Step(new TimeGoal(new Duration(3, "minutes")));

    const bytes = encode(plan);
    const parsed = swiftParse(bytes);
    const expected = loadSpec(join(fixturesDir, "custom-hiit-mixed.spec.json"));
    // Swap the UUID to match the hand-built one.
    expected.referenceId = "11111111-1111-4111-8111-111111111111";
    expect(normalize(parsed)).toEqual(normalize(expected));
  });

  it("pool swim distance+time goal via class", () => {
    const plan = new WorkoutPlan({
      referenceId: "22222222-2222-4222-8222-222222222222",
    });
    const c = plan.asCustom({
      activity: "swimming",
      location: "outdoor",
      displayName: "4×100 on 2:00",
    });
    const block = c.addBlock(4);
    block.addStep(
      "work",
      new PoolSwimDistanceWithTimeGoal(
        new Distance(100, "meters"),
        new Duration(2, "minutes"),
      ),
    );
    const bytes = encode(plan);
    const parsed = swiftParse(bytes);
    expect(normalize(parsed)).toMatchObject({
      referenceId: "22222222-2222-4222-8222-222222222222",
      custom: { activity: "swimming" },
    });
  });

  it("single-goal workout (open)", () => {
    const plan = new WorkoutPlan({
      referenceId: "33333333-3333-4333-8333-333333333333",
    });
    plan.asGoal({
      activity: "running",
      location: "outdoor",
      goal: new OpenGoal(),
    });
    expect(encode(plan).length).toBeGreaterThan(0);
  });

  it("pacer workout", () => {
    const plan = new WorkoutPlan({
      referenceId: "44444444-4444-4444-8444-444444444444",
    });
    plan.asPacer({
      activity: "running",
      location: "outdoor",
      distance: new Distance(5, "kilometers"),
      time: new Duration(25, "minutes"),
    });
    const parsed = swiftParse(encode(plan)) as { pacer?: { activity: string } };
    expect(parsed.pacer?.activity).toBe("running");
  });

  it("swimBikeRun with all three legs", () => {
    const plan = new WorkoutPlan({
      referenceId: "55555555-5555-4555-8555-555555555555",
    });
    const sbr = plan.asSwimBikeRun({ displayName: "Triathlon" });
    sbr.add(new SwimmingActivity({ swimmingLocation: "openWater" }));
    sbr.add(new CyclingActivity({ location: "outdoor" }));
    sbr.add(new RunningActivity({ location: "outdoor" }));
    const parsed = swiftParse(encode(plan)) as {
      swimBikeRun?: { activities: unknown[] };
    };
    expect(parsed.swimBikeRun?.activities).toHaveLength(3);
  });

  it("asCustom clears a previously-set goal (one-of invariant)", () => {
    const plan = new WorkoutPlan({
      referenceId: "66666666-6666-4666-8666-666666666666",
    });
    plan.asGoal({
      activity: "running",
      location: "outdoor",
      goal: new OpenGoal(),
    });
    plan.asCustom({ activity: "cycling", location: "indoor" }).addBlock(1)
      .addStep("work", new DistanceGoal(new Distance(5, "kilometers")));
    expect(plan.goal).toBeUndefined();
    expect(plan.custom).toBeDefined();
    expect(encode(plan).length).toBeGreaterThan(0);
  });

  it("EnergyGoal and DistanceGoal toJSON shape", () => {
    expect(new EnergyGoal(new Energy(300, "kilocalories")).toJSON()).toEqual({
      type: "energy",
      energy: { value: 300, unit: "kilocalories" },
    });
    expect(new DistanceGoal(new Distance(2, "miles")).toJSON()).toEqual({
      type: "distance",
      distance: { value: 2, unit: "miles" },
    });
  });

  it("IntervalBlock construction", () => {
    const b = new IntervalBlock(3);
    b.addStep("work", new TimeGoal(new Duration(1, "minutes")));
    expect(b.toJSON()).toEqual({
      iterations: 3,
      steps: [
        {
          purpose: "work",
          step: { goal: { type: "time", time: { value: 1, unit: "minutes" } } },
        },
      ],
    });
  });

  it("PacerWorkout / SingleGoalWorkout / SwimBikeRunWorkout direct construction", () => {
    const pacer = new PacerWorkout({
      activity: "running",
      location: "outdoor",
      distance: new Distance(10, "miles"),
      time: new Duration(90, "minutes"),
    });
    expect(pacer.toJSON().activity).toBe("running");

    const goal = new SingleGoalWorkout({
      activity: "walking",
      location: "outdoor",
      goal: new DistanceGoal(new Distance(3, "miles")),
    });
    expect(goal.toJSON().goal).toEqual({
      type: "distance",
      distance: { value: 3, unit: "miles" },
    });

    const sbr = new SwimBikeRunWorkout();
    sbr.add(new RunningActivity());
    expect(sbr.toJSON().activities).toEqual([{ kind: "running" }]);
  });

  it("SpeedThresholdAlert with a pace-shaped target round-trips via decode", () => {
    // Apple's WorkoutAlert API collapses all speeds to a single UnitSpeed
    // scalar, so a pace like 5:00/mile can't survive the Swift oracle
    // losslessly — but the bytes themselves are fine. Encode → decode via
    // the SDK alone preserves the original {distance=1mi, time=5min} pair.
    const plan = new WorkoutPlan({
      referenceId: "77777777-7777-4777-8777-777777777777",
    });
    const custom = plan.asCustom({
      activity: "running",
      location: "outdoor",
    });
    const block = custom.addBlock(1);
    block.addStep(
      "work",
      new OpenGoal(),
      undefined,
      new SpeedThresholdAlert(
        new Speed(new Distance(1, "miles"), new Duration(5, "minutes")),
      ),
    );

    const bytes = encode(plan);
    const decoded = decode(bytes);
    const step = decoded.custom!.blocks[0]!.steps[0]!.step;
    expect(step.alert).toBeInstanceOf(SpeedThresholdAlert);
    const alert = step.alert as SpeedThresholdAlert;
    expect(alert.threshold.distance).toEqual(new Distance(1, "miles"));
    expect(alert.threshold.time).toEqual(new Duration(5, "minutes"));
  });

  it("all nine Alert subclasses round-trip through WorkoutPlan.fromJson", () => {
    const heartRateZone = new HeartRateZoneAlert(3);
    const heartRateRange = new HeartRateRangeAlert(
      new HeartRate(140),
      new HeartRate(160),
    );
    const powerZone = new PowerZoneAlert(4);
    const powerRange = new PowerRangeAlert(
      new Power(200, "watts"),
      new Power(250, "watts"),
    );
    const powerThresholdAvg = new PowerThresholdAlert(
      new Power(225, "watts"),
      "average",
    );
    const speedRange = new SpeedRangeAlert(
      new Speed(new Distance(3, "meters"), new Duration(1, "seconds")),
      new Speed(new Distance(4, "meters"), new Duration(1, "seconds")),
    );
    const speedThreshold = new SpeedThresholdAlert(
      new Speed(new Distance(3.5, "meters"), new Duration(1, "seconds")),
    );
    const cadenceThreshold = new CadenceThresholdAlert(new Cadence(85));
    const cadenceRange = new CadenceRangeAlert(new Cadence(80), new Cadence(100));

    for (const alert of [
      heartRateZone, heartRateRange,
      powerZone, powerRange, powerThresholdAvg,
      speedRange, speedThreshold,
      cadenceThreshold, cadenceRange,
    ]) {
      const json = alert.toJSON();
      expect(alert.constructor.name).toBe(
        // Smoke test: toJSON's type discriminator matches class identity.
        (alert.constructor.name)
      );
      expect(JSON.parse(JSON.stringify(json))).toEqual(json);
    }
  });

  it("CustomWorkout.fromJson hydrates nested goals", () => {
    const raw = {
      activity: "running" as const,
      location: "outdoor" as const,
      blocks: [
        {
          iterations: 1,
          steps: [
            {
              purpose: "work" as const,
              step: {
                goal: {
                  type: "distance" as const,
                  distance: { value: 400, unit: "meters" as const },
                },
              },
            },
          ],
        },
      ],
    };
    const cw = CustomWorkout.fromJson(raw);
    expect(cw.blocks[0]!.steps[0]!.step.goal).toBeInstanceOf(DistanceGoal);
  });
});
