export interface SubmissionRequest {
  studentId: number;
  challengeId: number;
  sessionId: number;
  code: string;
}

export interface SubmissionResult {
  success: boolean;
  testsPassed: number;
  testsTotal: number;
  allPassed: boolean;
  pointsAwarded: number;
  compileError?: string;
  runtimeError?: string;
  testResults: TestCaseResult[];
  patternResults: PatternCheckResult[];
  executionTimeMs: number;
}

export interface TestCaseResult {
  testCaseId: number;
  description?: string;
  passed: boolean;
  expectedOutput?: string;
  actualOutput?: string;
  isHidden: boolean;
  error?: string;
}

export interface PatternCheckResult {
  passed: boolean;
  failureMessage: string;
}
