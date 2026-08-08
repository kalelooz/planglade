import { expect, test } from '@playwright/test'

async function expectTarget(locator: ReturnType<import('@playwright/test').Page['getByRole']>) {
  const box = await locator.boundingBox()
  expect(box && box.width >= 44 && box.height >= 44).toBeTruthy()
}

test('Connections keeps graph controls and List navigation usable at narrow widths', async ({ page }, testInfo) => {
  for (const width of [1280, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/connections')
    expect(await page.evaluate(() => {
      const measure = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector)
        return element ? [element.scrollWidth, element.clientWidth] : null
      }
      const [documentWidth, bodyWidth, rootWidth, graphWidth] = [
        [document.documentElement.scrollWidth, document.documentElement.clientWidth],
        [document.body.scrollWidth, document.body.clientWidth],
        measure('[data-connections-root]'),
        measure('[data-connections-graph]'),
      ]
      return [documentWidth, bodyWidth, rootWidth, graphWidth].every((pair) => pair && pair[0] === pair[1])
    })).toBeTruthy()
    await expect(page.locator('[data-connections-graph] [data-graph-edges="true"] path').first()).toBeVisible()

    if (width === 1280) {
      await page.locator('[data-connections-graph]').screenshot({ path: testInfo.outputPath('connections-desktop.png') })
    }

    if (width <= 768) {
      await expectTarget(page.getByLabel('Find a node'))
      await expectTarget(page.getByRole('tab', { name: 'Map' }))
      await expectTarget(page.getByRole('tab', { name: 'List' }))
      await expectTarget(page.getByRole('button', { name: 'Project nodes' }))
      await expectTarget(page.getByRole('button', { name: 'Fit all nodes' }))

      if (width === 390) {
        await page.locator('[data-connections-graph]').screenshot({ path: testInfo.outputPath('connections-mobile.png') })
        const node = page.locator('[data-connection-node]').first()
        await node.focus()
        await node.press('Enter')
        const inspector = page.getByRole('complementary', { name: 'Inspector' })
        await expect(inspector).toBeVisible()
        await inspector.screenshot({ path: testInfo.outputPath('connections-mobile-inspector.png') })
        await page.getByRole('button', { name: 'Close inspector' }).click()
        await expect(node).toBeFocused()
      }

      await page.getByRole('tab', { name: 'List' }).click()
      await expect(page.getByRole('region', { name: 'Relationship list' })).toBeVisible()
      expect(await page.evaluate(() => {
        const list = document.querySelector<HTMLElement>('[data-connections-list]')
        return !!list && list.scrollWidth === list.clientWidth
      })).toBeTruthy()
      await expectTarget(page.getByRole('region', { name: 'Relationship list' }).getByRole('button').first())
      if (width === 390) await page.getByRole('region', { name: 'Relationship list' }).screenshot({ path: testInfo.outputPath('connections-list.png') })
    }
  }
})
