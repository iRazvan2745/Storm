import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function SubscribeButton() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="px-3 py-1 text-sm font-medium text-gray-700 border border-gray-300 rounded-md">
        Subscribe
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Soon</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}