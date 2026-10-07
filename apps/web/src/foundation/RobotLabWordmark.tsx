type RobotLabWordmarkProps = { compact?: boolean };

/** Shared slanted OTT monogram and Robot Lab wordmark from the approved shell direction. */
export function RobotLabWordmark({ compact = false }: RobotLabWordmarkProps) {
  return (
    <span className={`robot-lab-wordmark${compact ? " compact" : ""}`} data-brand="robot-lab-wordmark">
      <span className="robot-lab-wordmark-mark" aria-hidden="true">OTT</span>
      <span className="robot-lab-wordmark-copy">
        <strong>OTT v2</strong>
        <small>OẲN TÙ TÌ</small>
      </span>
    </span>
  );
}
