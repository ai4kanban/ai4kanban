# 对话重试用量

Runner 的 `finish` 报告中，`usage` 累加本轮各次尝试报告的 token；其他运行时的 `costUsd` 累加各次尝试报告的费用。未报告的值不补零。尝试数据随本机检查点保存，恢复时继续累计，已完成报告直接重发。

Claude Code 的 `costUsd` 仍是最后一次尝试的会话总费用，另传有序 `attemptCosts: [{resume?, session?, costUsd?}]`。Cloud 根据每次实际续接的会话扣除已知基线，保存本轮费用总和；下一轮只扣除最后会话的总费用。缺少历史基线时不把历史算成本轮费用。旧 Runner 未传 `attemptCosts` 时保留原计算方式。
