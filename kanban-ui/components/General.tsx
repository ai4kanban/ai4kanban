"use client";

// Configuration → General: the settings groups that never needed a pane each.
//
// Setup (#174) is two rows — the skill in this project, the `akb` command on the PATH.
// Delivery (#303, #308) is two switches. Runs (#394) is the silence limit. Privacy (#293)
// is the usage-reporting switch. Language (#334) is one control. A pane each was a sidebar
// you had to walk to find anything; one pane shows all of it at a glance, and each group's
// caption is the whole of its explanation.
//
// Nothing is drawn here: each group is its own file, beside the state it reads. What makes
// the groups read apart is in components/settings.tsx — a caption on the pane's ground and
// the settings themselves in one card under it.

import { DeliveryGroup } from "./AutoDelivery";
import { LanguageGroup } from "./language";
import { PrivacyGroup } from "./Privacy";
import { RunsGroup } from "./Runs";
import { SetupGroup } from "./Skill";

export function GeneralPanel({ onError }: { onError?: (msg: string) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <SetupGroup onError={onError} />
      <DeliveryGroup onError={onError} />
      <RunsGroup onError={onError} />
      <PrivacyGroup onError={onError} />
      <LanguageGroup onError={onError} />
    </div>
  );
}
