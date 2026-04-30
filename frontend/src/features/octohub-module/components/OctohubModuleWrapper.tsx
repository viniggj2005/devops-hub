import React from 'react';
import OctohubShell from './OctohubShell';
import OctohubHomePage from '../pages/OctohubHomePage';
import { Routes, Route, Navigate } from 'react-router-dom';
import { EventsOn } from '../../../../wailsjs/runtime/runtime';
import { VerificarLogin, GetUserInfo } from '../../../../wailsjs/go/octohubHandlers/OctohubHandler';

const OctohubModuleWrapper: React.FC = () => {
    const [isLoggedIn, setIsLoggedIn] = React.useState<boolean | null>(null);
    const [githubUser, setGithubUser] = React.useState<any>(null);

    const checkLogin = React.useCallback(async () => {
        try {
            const token = await VerificarLogin();
            if (token) {
                setIsLoggedIn(true);
                const user = await GetUserInfo();
                setGithubUser(user);
            } else {
                setIsLoggedIn(false);
                setGithubUser(null);
            }
        } catch (error) {
            console.error("Erro ao verificar login:", error);
            setIsLoggedIn(false);
        }
    }, []);

    React.useEffect(() => {
        checkLogin();
        const unbind = EventsOn('login-success', (success: boolean) => {
            if (success) checkLogin();
        });
        return () => unbind();
    }, [checkLogin]);

    return (
        <OctohubShell isLoggedIn={isLoggedIn}>
            <Routes>
                <Route
                    path="/octohub/home"
                    element={
                        <OctohubHomePage
                            isLoggedIn={isLoggedIn}
                            githubUser={githubUser}
                            checkLogin={checkLogin}
                        />
                    }
                />
                <Route path="/" element={<Navigate to="/octohub/home" replace />} />
                <Route path="/octohub" element={<Navigate to="/octohub/home" replace />} />
            </Routes>
        </OctohubShell>
    );
};

export default OctohubModuleWrapper;
