import iziToast from 'izitoast';
import OctohubShell from './OctohubShell';
import GitCredentialsModal from './GitCredentialsModal';
import { useAuth } from '../../../contexts/AuthContext';
import CloneRepositoryModal from './CloneRepositoryModal';
import CreateRepositoryModal from './CreateRepositoryModal';
import PublishRepositoryModal from './PublishRepositoryModal';
import { Routes, Route, Navigate } from 'react-router-dom';
import GithubAccountSwitcher from './GithubAccountSwitcher';
import { errorMessage } from '../../shared/functions/ErrorMessage';
import * as octohubDtos from '../../../../bindings/docker-manager-go/src/octohub/dtos/models';
import { Events } from '@wailsio/runtime';
import ConflictResolutionModal from './ConflictResolutionModal';
import React, { useCallback, useEffect, useState } from 'react';
import OctohubHomePage from '../../../pages/octohub/OctohubHomePage';
import DeviceLoginModal, { DeviceLoginState } from './DeviceLoginModal';
import CommitHistoryPage from '../../../pages/octohub/CommitHistoryPage';
import { useConfirmToast } from '../../shared/components/toasts/ConfirmToast';
import { OctohubRepositoryProvider } from '../contexts/OctohubRepositoryContext';
import {
    GetUserInfo,
    ListAccounts,
    SwitchAccount,
    RemoveAccount,
    GetActiveAccount,
    StartDeviceLogin,
    CancelDeviceLogin,
} from '../../../../bindings/docker-manager-go/src/octohub/handlers/octohubhandler';

const closedLogin: DeviceLoginState = { open: false, loading: false, error: null, deviceCode: null };

const OctohubModuleWrapper: React.FC = () => {
    const { token } = useAuth();
    const confirmToast = useConfirmToast();
    const [githubUser, setGithubUser] = useState<any>(null);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
    const [loginState, setLoginState] = useState<DeviceLoginState>(closedLogin);
    const [accounts, setAccounts] = useState<octohubDtos.GithubAccountDto[]>([]);

    const checkLogin = useCallback(async () => {
        if (!token) {
            setIsLoggedIn(false);
            return;
        }
        try {
            const activeAccount = await GetActiveAccount(token);
            if (!activeAccount) {
                setAccounts([]);
                setGithubUser(null);
                setIsLoggedIn(false);
                return;
            }
            setAccounts(await ListAccounts(token));
            setIsLoggedIn(true);
            setGithubUser(await GetUserInfo(token));
        } catch (error) {
            setGithubUser(null);
            iziToast.error({ title: 'GitHub', message: errorMessage(error), position: 'bottomRight' });
        }
    }, [token]);

    const startLogin = useCallback(async () => {
        if (!token) return;
        setLoginState({ open: true, loading: true, error: null, deviceCode: null });
        try {
            const deviceCode = await StartDeviceLogin(token);
            setLoginState({ open: true, loading: false, error: null, deviceCode });
        } catch (error) {
            setLoginState({ open: true, loading: false, error: errorMessage(error), deviceCode: null });
        }
    }, [token]);

    const closeLogin = useCallback(() => {
        CancelDeviceLogin();
        setLoginState(closedLogin);
    }, []);

    const switchAccount = async (accountId: number) => {
        if (!token) return;
        try {
            await SwitchAccount(token, accountId);
            await checkLogin();
        } catch (error) {
            iziToast.error({ title: 'GitHub', message: errorMessage(error), position: 'bottomRight' });
        }
    };

    const removeAccount = (account: octohubDtos.GithubAccountDto) => {
        if (!token) return;
        confirmToast({
            id: `github-account-${account.id}`,
            title: `Conta @${account.login} removida!`,
            message: `Deseja remover a conta @${account.login} do OctoHub?`,
            onConfirm: async () => {
                await RemoveAccount(token, account.id);
                await checkLogin();
            },
        });
    };

    useEffect(() => {
        checkLogin();
    }, [checkLogin]);

    useEffect(() => {
        const offSuccess = Events.On('octohub:login-success', (event) => {
            const account: octohubDtos.GithubAccountDto = event.data;
            setLoginState(closedLogin);
            iziToast.success({ title: 'GitHub', message: `Conta @${account.login} conectada.`, position: 'bottomRight' });
            checkLogin();
        });
        const offError = Events.On('octohub:login-error', ({ data: message }) => {
            setLoginState((previous) => (previous.open ? { ...previous, loading: false, error: message } : previous));
        });
        return () => {
            offSuccess();
            offError();
        };
    }, [checkLogin]);

    const homePage = (
        <OctohubHomePage
            isLoggedIn={isLoggedIn}
            githubUser={githubUser}
            onConnect={startLogin}
        />
    );

    const activeAccount = accounts.find((account) => account.isActive) ?? null;

    return (
        <OctohubRepositoryProvider githubAccount={isLoggedIn ? activeAccount : null}>
            <OctohubShell
                isLoggedIn={isLoggedIn}
                accountSwitcher={
                    <GithubAccountSwitcher
                        accounts={accounts}
                        onAdd={startLogin}
                        onSwitch={switchAccount}
                        onRemove={removeAccount}
                    />
                }
            >
                <Routes>
                    <Route path="/octohub/home" element={homePage} />
                    <Route
                        path="/octohub/history"
                        element={
                            <CommitHistoryPage />
                        }
                    />
                    <Route path="/" element={<Navigate to="/octohub/home" replace />} />
                    <Route path="/octohub" element={<Navigate to="/octohub/home" replace />} />
                    <Route path="*" element={homePage} />
                </Routes>
                <DeviceLoginModal state={loginState} onRetry={startLogin} onClose={closeLogin} />
                <CloneRepositoryModal />
                <CreateRepositoryModal />
                <PublishRepositoryModal />
                <ConflictResolutionModal />
                <GitCredentialsModal />
            </OctohubShell>
        </OctohubRepositoryProvider>
    );
};

export default OctohubModuleWrapper;
