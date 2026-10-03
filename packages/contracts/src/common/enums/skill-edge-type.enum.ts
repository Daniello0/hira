/** Edge type in the skill graph. Values follow Wiki/04-data-model.md. */
export enum SkillEdgeType {
  AlternativeOf = 'ALTERNATIVE_OF',
  Broader = 'BROADER',
  Narrower = 'NARROWER',
  RelatedTo = 'RELATED_TO',
  PrerequisiteOf = 'PREREQUISITE_OF',
}
