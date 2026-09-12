import fs from 'node:fs'

const path = 'api/src/serviceRequestState.js'
let text = fs.readFileSync(path, 'utf8')

const marker = `        if (task.status === 'Completed' && changeStatus && body.status !== 'Completed') {
          const error = new Error('Completed tasks cannot be reopened from the Tasks queue.')
          error.status = 409
          throw error
        }

        const team = changeTeam ? await resolveTaskTeam(client, auth.session.tenant_id, body.teamId ?? body.team) : null
`

const replacement = `        if (task.status === 'Completed' && changeStatus && body.status !== 'Completed') {
          const error = new Error('Completed tasks cannot be reopened from the Tasks queue.')
          error.status = 409
          throw error
        }

        const actor = await actorSnapshot(client, auth.session)
        if ((changeStatus || changeCompletion) && (!actor.person?.id || task.assignee_person_id !== actor.person.id)) {
          const error = new Error('Take this task before starting, blocking or completing work.')
          error.status = 409
          throw error
        }

        const team = changeTeam ? await resolveTaskTeam(client, auth.session.tenant_id, body.teamId ?? body.team) : null
`

if (!text.includes(marker)) throw new Error('Task work guard insertion point not found')
text = text.replace(marker, replacement)

const laterActor = `        const actor = await actorSnapshot(client, auth.session)
        await client.query(
`
if (!text.includes(laterActor)) throw new Error('Later actor declaration not found')
text = text.replace(laterActor, `        await client.query(
`)

fs.writeFileSync(path, text)
