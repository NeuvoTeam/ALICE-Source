'use client'

import {
  Sidebar as UISidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar'
import { ClientNode } from './ClientNode'

export function Sidebar() {
  return (
    <UISidebar collapsible="icon">
      <SidebarHeader>
        {/* optional header content */}
      </SidebarHeader>

      <SidebarContent>
        <ClientNode />
      </SidebarContent>

      <SidebarFooter>
        {/* optional footer content */}
      </SidebarFooter>
    </UISidebar>
  )
}