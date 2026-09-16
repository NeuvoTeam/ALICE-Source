# Playbook: Escalation

Stop execution immediately. Prepare the handover payload for human review or a frontier model (Claude 3.5 Sonnet).

## Escalation Payload (Keep it small)
Write a file named `escalation-context.txt` in the root:
- task_id, target paths
- verify.sh exit code + last 40 lines of output
- diff so far (`git diff --stat`)
- what was already attempted (one line per attempt)

Do not send full file contents. Do not send conversation history. Status is BLOCKED.