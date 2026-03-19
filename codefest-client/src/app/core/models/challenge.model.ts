export interface Challenge {
  id: number;
  title: string;
  description: string;
  starterCode: string;
  order: number;
  points: number;
  timeLimitSeconds: number;
  difficulty: DifficultyLevel;
  testCases: TestCase[];
  patternChecks: CodePatternCheck[];
}

export enum DifficultyLevel {
  Easy = 0,
  Medium = 1,
  Hard = 2,
  Boss = 3,
}

export interface TestCase {
  id: number;
  challengeId: number;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  order: number;
  description?: string;
}

export interface CodePatternCheck {
  id: number;
  challengeId: number;
  type: PatternCheckType;
  pattern: string;
  isRegex: boolean;
  failureMessage: string;
}

export enum PatternCheckType {
  MustContain = 0,
  MustNotContain = 1,
}
