/**
 * Session Management Tests
 * Tests for SessionTimeoutWarning, SessionMonitor, and useSessionManagement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { render, screen, fireEvent } from '@testing-library/react'
import { useSessionManagement } from '../../../hooks/useSessionManagement'
import SessionTimeoutWarning from '../SessionTimeoutWarning'
import SessionMonitor from '../SessionMonitor'

// Mock authService
vi.mock('../../../services/authService', () => ({
  authService: {
    refreshToken: vi.fn().mockResolvedValue({ success: true }),
    logout: vi.fn().mockResolvedValue(undefined),
    getStoredToken: vi.fn().mockReturnValue('mock-token')
  }
}))

describe('useSessionManagement Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('should initialize with active status', () => {
    const { result } = renderHook(() => useSessionManagement())

    expect(result.current.isActive).toBe(true)
    expect(result.current.status).toBe('active')
    expect(result.current.showWarning).toBe(false)
  })

  it('should show warning before timeout', async () => {
    const onWarning = vi.fn()
    const { result } = renderHook(() =>
      useSessionManagement(undefined, onWarning, {
        timeoutMinutes: 30,
        warningMinutes: 5
      })
    )

    // Fast-forward to warning time (25 minutes)
    act(() => {
      vi.advanceTimersByTime(25 * 60 * 1000)
    })

    await waitFor(() => {
      expect(result.current.showWarning).toBe(true)
      expect(result.current.status).toBe('warning')
      expect(onWarning).toHaveBeenCalledWith(5)
    })
  })

  it('should extend session when requested', async () => {
    const { result } = renderHook(() => useSessionManagement())

    await act(async () => {
      await result.current.extendSession()
    })

    expect(result.current.status).toBe('active')
    expect(result.current.showWarning).toBe(false)
  })

  it('should reset timer on activity', () => {
    const { result } = renderHook(() =>
      useSessionManagement(undefined, undefined, {
        extendOnActivity: true
      })
    )

    const initialTimeLeft = result.current.timeLeft

    // Simulate activity
    act(() => {
      result.current.handleActivity()
    })

    expect(result.current.timeLeft).toBeGreaterThanOrEqual(initialTimeLeft)
  })
})

describe('SessionTimeoutWarning Component', () => {
  it('should render when open', () => {
    const onExtend = vi.fn()
    const onLogout = vi.fn()

    render(
      <SessionTimeoutWarning
        open={true}
        timeRemaining={300}
        onExtendSession={onExtend}
        onLogoutNow={onLogout}
      />
    )

    expect(screen.getByText(/Session Expiring Soon/i)).toBeInTheDocument()
    expect(screen.getByText(/5:00/)).toBeInTheDocument()
  })

  it('should call onExtendSession when Stay Logged In is clicked', () => {
    const onExtend = vi.fn()
    const onLogout = vi.fn()

    render(
      <SessionTimeoutWarning
        open={true}
        timeRemaining={300}
        onExtendSession={onExtend}
        onLogoutNow={onLogout}
      />
    )

    const stayButton = screen.getByText(/Stay Logged In/i)
    fireEvent.click(stayButton)

    expect(onExtend).toHaveBeenCalled()
  })

  it('should call onLogoutNow when Logout Now is clicked', () => {
    const onExtend = vi.fn()
    const onLogout = vi.fn()

    render(
      <SessionTimeoutWarning
        open={true}
        timeRemaining={300}
        onExtendSession={onExtend}
        onLogoutNow={onLogout}
      />
    )

    const logoutButton = screen.getByText(/Logout Now/i)
    fireEvent.click(logoutButton)

    expect(onLogout).toHaveBeenCalled()
  })

  it('should update countdown timer', () => {
    vi.useFakeTimers()
    const onExtend = vi.fn()
    const onLogout = vi.fn()

    render(
      <SessionTimeoutWarning
        open={true}
        timeRemaining={300}
        onExtendSession={onExtend}
        onLogoutNow={onLogout}
      />
    )

    expect(screen.getByText(/5:00/)).toBeInTheDocument()

    // Advance time by 1 second
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByText(/4:59/)).toBeInTheDocument()

    vi.useRealTimers()
  })
})

describe('SessionMonitor Component', () => {
  it('should not render when showIndicator is false', () => {
    const { container } = render(
      <SessionMonitor
        sessionStatus="active"
        timeRemaining={1800}
        onActivity={vi.fn()}
        showIndicator={false}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('should render active status indicator', () => {
    render(
      <SessionMonitor
        sessionStatus="active"
        timeRemaining={1800}
        onActivity={vi.fn()}
        showIndicator={true}
      />
    )

    expect(screen.getByText(/Session Active/i)).toBeInTheDocument()
  })

  it('should render warning status indicator', () => {
    render(
      <SessionMonitor
        sessionStatus="warning"
        timeRemaining={300}
        onActivity={vi.fn()}
        showIndicator={true}
      />
    )

    expect(screen.getByText(/Session Expiring/i)).toBeInTheDocument()
  })

  it('should render expired status indicator', () => {
    render(
      <SessionMonitor
        sessionStatus="expired"
        timeRemaining={0}
        onActivity={vi.fn()}
        showIndicator={true}
      />
    )

    expect(screen.getByText(/Session Expired/i)).toBeInTheDocument()
  })

  it('should call onActivity when user interacts', () => {
    const onActivity = vi.fn()

    render(
      <SessionMonitor
        sessionStatus="active"
        timeRemaining={1800}
        onActivity={onActivity}
        showIndicator={true}
      />
    )

    // Simulate user activity
    fireEvent.mouseDown(window)

    expect(onActivity).toHaveBeenCalled()
  })
})
