// The figures a post can draw on. Every name here is in scope inside an MDX
// body — `BlogMdx.tsx` hands the whole set to the compiler — so a post writes
// `<BottleneckShift />` on a line of its own and gets a mounted, captioned
// figure. Adding one means adding it here and nowhere else.
export { BottleneckShift } from "./BottleneckShift";
export { PlanningLoad } from "./PlanningLoad";
export { ContextOnCard } from "./ContextOnCard";
export { ThreeLayers } from "./ThreeLayers";
export { PlanningLayer } from "./PlanningLayer";
export { DecisionLoop } from "./DecisionLoop";
export { SelfBoardProgress } from "./SelfBoardProgress";
export { MemoryFiles } from "./MemoryFiles";
export { RequirementCascade } from "./RequirementCascade";
export { BoardAudience } from "./BoardAudience";
export { DecisionCompression } from "./DecisionCompression";
