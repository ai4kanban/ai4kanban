import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { executionHeld, executionOf } from '../src/lib/cloud/execution'
import { cloudEndpoints } from '../src/lib/cloud/config'
import { writeSession } from '../src/lib/cloud/session'
import { readDeliveryRow } from '../src/lib/agent/store'

const held = { job: '11111111-1111-4111-8111-111111111111', machine: '22222222-2222-4222-8222-222222222222' }
const fetchBefore = globalThis.fetch
let home: string
let homeBefore: string | undefined
beforeEach(() => {
  homeBefore=process.env.AI4KANBAN_HOME
  home=fs.mkdtempSync(path.join(os.tmpdir(),'akb-execution-'))
  process.env.AI4KANBAN_HOME=home
  writeSession({version:1,supabaseUrl:cloudEndpoints().supabaseUrl,accessToken:'test',refreshToken:'test',expiresAt:Date.now()+3600000,subject:'test'})
})
afterEach(() => {
  globalThis.fetch=fetchBefore
  if(homeBefore===undefined) delete process.env.AI4KANBAN_HOME
  else process.env.AI4KANBAN_HOME=homeBefore
  fs.rmSync(home,{recursive:true,force:true})
})
describe('落地执行权', () => {
  it('本地交付不调用云端；记录只接受实际执行和电脑编号', async () => {
    globalThis.fetch=async()=>{throw new Error('不应请求云端')}
    assert.equal(await executionHeld(),true)
    assert.deepEqual(executionOf(JSON.stringify(held)),held)
    assert.equal(executionOf('{"job":"bad","machine":"bad"}'),undefined)
  })
  it('读取历史交付时不继承当前进程的执行权', () => {
    const previous = process.env.AI4KANBAN_EXECUTION
    process.env.AI4KANBAN_EXECUTION = JSON.stringify(held)
    try {
      assert.equal(readDeliveryRow({ deliveryId: 'old' })?.cloudExecution, undefined)
      assert.deepEqual(readDeliveryRow({ deliveryId: 'current', cloudExecution: held })?.cloudExecution, held)
    } finally {
      if (previous === undefined) delete process.env.AI4KANBAN_EXECUTION
      else process.env.AI4KANBAN_EXECUTION = previous
    }
  })
  it('仅租约有效且未被停止时允许落地；换机后、停止与断网均拒绝', async () => {
    for(const response of [{renewed:true,stop:false},{renewed:false},{renewed:true,stop:true}]) {
      globalThis.fetch=async(url, init)=>{
        assert.ok(String(url).endsWith(`/jobs/${held.job}/renew`))
        assert.deepEqual(JSON.parse(String(init?.body)),{machineId:held.machine})
        return new Response(JSON.stringify(response),{status:200})
      }
      assert.equal(await executionHeld(held),response.renewed===true&&response.stop!==true)
    }
    globalThis.fetch=async()=>{throw new Error('断网')}
    assert.equal(await executionHeld(held),false)
  })
})
