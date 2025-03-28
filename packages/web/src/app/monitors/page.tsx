import { MonitorsPage } from "@/components/monitors-page"
import Nav from "@/components/nav"
import Footer from "@/components/footer"

export default function Monitors() {
  return (
    <main className="min-h-screen flex flex-col">
      <Nav />
      <div className="flex-grow">
        <MonitorsPage />
      </div>
      <Footer />
    </main>
  )
}
