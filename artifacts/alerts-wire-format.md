# WorkoutAlert wire format (Phase 0 findings)

Derived by feeding one fixture per alert subtype through the Swift oracle
(`wkc encode`) with the live `WorkoutKit.framework` and raw-decoding the
bytes. Sources in `tmp/alert-probe/`.

## WorkoutStep

- Field 1: `goal` (WorkoutGoal)
- Field 2: `alert` (WorkoutAlert) — **singular**, despite the proto
  message having four per-metric sub-fields
- Field 3: `displayName` (string)

## WorkoutAlert

```
1  targetType   varint  (AlertTargetType enum)
2  targetKind   varint  (AlertTargetKind enum)
4  speedAlert      SpeedAlert
5  cadenceAlert    CadenceAlert
6  powerAlert      PowerAlert
7  heartRateAlert  HeartRateAlert
```

Exactly one of fields 4/5/6/7 is set per alert; the pair of enums in
fields 1/2 describes the axis and shape.

### AlertTargetType
```
0 UNKNOWN_METRIC
1 AVERAGE_SPEED
2 CURRENT_SPEED
3 CURRENT_CADENCE
4 CURRENT_POWER
5 CURRENT_HEART_RATE
6 AVERAGE_POWER
```
Cadence and heart-rate only take `CURRENT_*`; power and speed accept both
`CURRENT_*` and `AVERAGE_*` via the `WorkoutAlertMetric` parameter.

### AlertTargetKind
```
0 UNKNOWN
1 VALUE    (single-threshold)
2 RANGE
3 ZONE
```

## Per-metric sub-alerts

```
SpeedAlert         1: speedSingleTarget  (SpeedValue)
                   2: speedRangeTarget   (SpeedRange)

CadenceAlert       1: cadenceSingleTarget (CadenceValue)
                   2: cadenceRangeTarget  (CadenceRange)

PowerAlert         1: powerSingleTarget  (PowerValue)
                   2: powerRangeTarget   (PowerRange)
                   3: zoneTarget         (ZoneValue)

HeartRateAlert     1: zoneTarget           (ZoneValue)
                   2: heartRateRangeTarget (HeartRateRange)
```

Apple's public API exposes no `SpeedZoneAlert`, `CadenceZoneAlert`, or
`HeartRateThresholdAlert`, and the oracle declines to construct them.

## Value / range messages

```
HeartRateRange   1: minHeartRate (HeartRateValue)
                 2: maxHeartRate (HeartRateValue)
PowerRange       1: minPower     (PowerValue)
                 2: maxPower     (PowerValue)
SpeedRange       1: minSpeed     (SpeedValue)
                 2: maxSpeed     (SpeedValue)
CadenceRange     1: minCadence   (CadenceValue)
                 2: maxCadence   (CadenceValue)

PowerValue       { unit: enum (1=watts), value: double }     // standard Quantity
HeartRateValue   { 1: double beatsPerMinute }                // single field, raw bpm
ZoneValue        { 1: uint32 zone }
SpeedValue       { 1: distance (DistanceValue), 2: time (TimeValue) }
CadenceValue     { 1: uint32 count, 2: duration (TimeValue) }
```

### SpeedValue semantics

Speed rides on a `{distance, time}` pair, not a raw speed magnitude. For
3.5 m/s the oracle writes `{distance: 3.5 m, time: 1 s}`. Pace alerts
aren't a separate subtype in Apple's API but fall out naturally — express
them as `{distance: 1 mile, time: 5 min}` for a 5:00/mi pace.

### CadenceValue semantics

Cadence also stores `{count, duration}`. 85 cpm encodes as
`{count: 85, duration: 1 minute}`.

### HeartRateValue semantics

HeartRateValue has one double field and stores bpm directly — Apple uses
`WorkoutAlertMetric.countPerMinute` as the canonical `UnitFrequency`.
Passing a Foundation-built `UnitFrequency` with the same `"count/min"`
symbol but a different `UnitConverterLinear` coefficient causes
`HKQuantity` to misconvert; always round-trip through Apple's canonical
unit on the Swift side.

## Out of scope for now

- `heartRateAlertTarget` / `cadenceAlertTarget` / `speedAlertTarget` /
  `powerAlertTarget` sub-fields (all emitted at field 3 of the per-metric
  message per reflection order). Apple never writes them in the probes we
  sent, so the enum in the outer WorkoutAlert is the sole discriminator.
  Revisit if we see them in a real `.workout` sample.
