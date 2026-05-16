import { BrowserRouter } from 'react-router-dom'
import AppRouter from './router'

const BUILD = 'v1.3.0'

export default function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  )
}

export { BUILD }
