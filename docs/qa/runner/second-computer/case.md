# 在第二台电脑上启动 Runner

## Setup

- 账号已在第一台电脑上登录 Runner，且它正在运行（见 [第一次启动 Runner 并登录](../sign-in-and-connect/case.md)）。
- 第二台电脑用同一账号登录过 Runner。取证时用另一个 `WILDCRANE_HOME` 代替第二台电脑。

## Steps

1. 在第二台电脑上执行 `wildcrane-runner`。
   预期：提示 Runner 已在第一台电脑上连接、需先在那里退出，然后退出，不会抢走连接。
   证据：[01-refused.log](01-refused.log)

## Feedback

提示直说了原因和办法，并点出了另一台电脑的名字。但两台电脑同名时（取证时就是同一台机器），
这句话读起来像在说自己；第一台电脑已经关机却没释放连接时要等多久，本用例未覆盖。
